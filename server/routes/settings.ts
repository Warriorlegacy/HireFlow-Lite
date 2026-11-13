import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, requireRole, audit, clientIp } from '../auth';
import { canManageSettings } from '../permissions';
import { runRetention } from '../retention';
import { newId } from '../crypto';
import { slugify } from '../util';

export const settingsRouter = new Hono<AppEnv>();
settingsRouter.use('*', requireAuth());

settingsRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const [stages, retention, usage, applications, seats, activeJobs] = await Promise.all([
    db.all<any>('SELECT * FROM pipeline_stages WHERE organization_id = ? ORDER BY position', [auth.org.id]),
    db.all<any>('SELECT * FROM retention_rules WHERE organization_id = ? ORDER BY category', [auth.org.id]),
    db.all<any>('SELECT * FROM usage_limits WHERE organization_id = ?', [auth.org.id]),
    db.get<any>("SELECT COUNT(*) AS n FROM applications WHERE organization_id = ? AND applied_at >= ?", [auth.org.id, Date.now() - 30 * 86400_000]),
    db.get<any>("SELECT COUNT(*) AS n FROM memberships WHERE organization_id = ? AND status = 'active'", [auth.org.id]),
    db.get<any>("SELECT COUNT(*) AS n FROM jobs WHERE organization_id = ? AND status = 'published'", [auth.org.id]),
  ]);
  const emailConfigured = Boolean(c.env.RESEND_API_KEY);
  const aiAvailable = Boolean(c.env.AI_ENABLED === 'true' && c.env.GEMINI_API_KEY);
  return c.json({
    organization: auth.org,
    stages,
    retention,
    usage: {
      active_jobs: Number(activeJobs?.n || 0),
      team_seats: Number(seats?.n || 0),
      monthly_applications: Number(applications?.n || 0),
      guidance: { active_jobs: 5, team_seats: 10, monthly_applications: 100 },
      note: 'These are pilot guidance levels, not enforced billing limits.',
    },
    integrations: {
      email: { configured: emailConfigured, provider: emailConfigured ? 'resend' : null, from: auth.org.email_from || c.env.EMAIL_FROM || null },
      ai: { enabled: auth.org.ai_enabled === 1, available: aiAvailable, provider: auth.org.ai_provider || null, note: 'AI assistance is off by default and never makes hiring decisions.' },
      storage: { backend: c.env.FILES ? 'r2' : 'd1', note: c.env.FILES ? 'Resumes stored in private R2 with authenticated downloads.' : 'R2 is not enabled on this account; resumes are stored as encrypted-at-rest D1 rows with authenticated downloads.' },
    },
    can_manage: canManageSettings(auth),
  });
});

const settingsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  website: z.string().max(300).nullable().optional(),
  careers_intro: z.string().max(2000).nullable().optional(),
  privacy_notice_version: z.string().max(40).optional(),
  privacy_notice_url: z.string().max(400).nullable().optional(),
  default_retention_days: z.number().int().min(30).max(3650).optional(),
  ai_enabled: z.boolean().optional(),
  email_from: z.string().max(200).nullable().optional(),
});

settingsRouter.patch('/', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Check the workspace settings.');
  const d = parsed.data;

  if (d.ai_enabled === true) {
    const available = c.env.AI_ENABLED === 'true' && Boolean(c.env.GEMINI_API_KEY);
    if (!available) {
      return fail(c, 422, 'AI_NOT_CONFIGURED', 'AI assistance has no configured provider. Add GEMINI_API_KEY and set AI_ENABLED=true before enabling it.');
    }
    if (!['owner', 'admin'].includes(auth.membership.role)) return fail(c, 403, 'FORBIDDEN', 'Only an owner or admin can change AI settings.');
  }

  const org = auth.org;
  await db.run(
    `UPDATE organizations SET name = ?, website = ?, careers_intro = ?, privacy_notice_version = ?,
       privacy_notice_url = ?, default_retention_days = ?, ai_enabled = ?, ai_provider = ?, email_from = ?, updated_at = ?
     WHERE id = ?`,
    [
      d.name ?? org.name,
      d.website !== undefined ? d.website : org.website,
      d.careers_intro !== undefined ? d.careers_intro : org.careers_intro,
      d.privacy_notice_version ?? org.privacy_notice_version,
      d.privacy_notice_url !== undefined ? d.privacy_notice_url : org.privacy_notice_url,
      d.default_retention_days ?? org.default_retention_days,
      d.ai_enabled === undefined ? org.ai_enabled : d.ai_enabled ? 1 : 0,
      d.ai_enabled === undefined ? org.ai_provider : d.ai_enabled ? 'gemini' : null,
      d.email_from !== undefined ? d.email_from : org.email_from,
      Date.now(), org.id,
    ],
  );
  if (d.default_retention_days) {
    await db.run(
      "UPDATE retention_rules SET retention_days = ?, updated_at = ? WHERE organization_id = ? AND category = 'applications'",
      [d.default_retention_days, Date.now(), org.id],
    );
  }
  await audit(db, auth, 'settings.updated', 'organization', org.id, { fields: Object.keys(d) }, clientIp(c));
  const updated = await db.get<any>('SELECT * FROM organizations WHERE id = ?', [org.id]);
  return c.json({ organization: updated });
});

const stagesSchema = z.object({
  stages: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(40),
    kind: z.enum(['active', 'offer', 'hired', 'rejected', 'withdrawn']).default('active'),
  })).min(3).max(12),
});

settingsRouter.put('/stages', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = stagesSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'A pipeline needs between three and twelve stages.');

  const existing = await db.all<any>('SELECT * FROM pipeline_stages WHERE organization_id = ?', [auth.org.id]);
  const incoming = parsed.data.stages;
  const requiredKeys = ['new', 'rejected', 'withdrawn'];
  for (const key of requiredKeys) {
    const source = existing.find((e) => e.key === key);
    if (source && !incoming.some((i) => i.id === source.id)) {
      return fail(c, 422, 'REQUIRED_STAGE', `The ${source.name} stage is required and cannot be removed.`);
    }
  }

  // Removing a stage is only allowed when it holds no applications.
  for (const old of existing) {
    if (!incoming.some((i) => i.id === old.id)) {
      const used = await db.get<any>('SELECT COUNT(*) AS n FROM applications WHERE stage_id = ?', [old.id]);
      if (Number(used?.n || 0) > 0) return fail(c, 409, 'STAGE_IN_USE', `${old.name} still holds applications. Move them before removing the stage.`);
    }
  }

  const now = Date.now();
  const statements: { sql: string; params: unknown[] }[] = [];
  let position = 0;
  for (const item of incoming) {
    const old = item.id ? existing.find((e) => e.id === item.id) : null;
    if (old) {
      statements.push({
        sql: 'UPDATE pipeline_stages SET name = ?, position = ?, kind = ? WHERE id = ? AND organization_id = ?',
        params: [item.name.trim(), position, old.kind === 'active' ? item.kind : old.kind, old.id, auth.org.id],
      });
    } else {
      statements.push({
        sql: 'INSERT INTO pipeline_stages (id, organization_id, key, name, position, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [newId('stg'), auth.org.id, `${slugify(item.name) || 'stage'}-${position}`, item.name.trim(), position, item.kind, now],
      });
    }
    position++;
  }
  for (const old of existing) {
    if (!incoming.some((i) => i.id === old.id)) {
      statements.push({ sql: 'DELETE FROM pipeline_stages WHERE id = ? AND organization_id = ?', params: [old.id, auth.org.id] });
    }
  }
  await db.batch(statements);
  await audit(db, auth, 'settings.stages_updated', 'organization', auth.org.id, { count: incoming.length }, clientIp(c));
  const stages = await db.all<any>('SELECT * FROM pipeline_stages WHERE organization_id = ? ORDER BY position', [auth.org.id]);
  return c.json({ stages });
});

const retentionSchema = z.object({
  applications_days: z.number().int().min(30).max(3650),
  audit_days: z.number().int().min(90).max(3650).optional(),
});

settingsRouter.put('/retention', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = retentionSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Retention must be between 30 and 3650 days.');
  const now = Date.now();
  await db.run(
    "UPDATE retention_rules SET retention_days = ?, updated_at = ? WHERE organization_id = ? AND category = 'applications'",
    [parsed.data.applications_days, now, auth.org.id],
  );
  await db.run(
    "UPDATE retention_rules SET retention_days = ?, updated_at = ? WHERE organization_id = ? AND category = 'resumes'",
    [parsed.data.applications_days, now, auth.org.id],
  );
  if (parsed.data.audit_days) {
    await db.run(
      "UPDATE retention_rules SET retention_days = ?, updated_at = ? WHERE organization_id = ? AND category = 'audit'",
      [parsed.data.audit_days, now, auth.org.id],
    );
  }
  await db.run('UPDATE organizations SET default_retention_days = ?, updated_at = ? WHERE id = ?', [parsed.data.applications_days, now, auth.org.id]);
  await audit(db, auth, 'settings.retention_updated', 'organization', auth.org.id, { days: parsed.data.applications_days }, clientIp(c));
  return c.json({ success: true });
});

settingsRouter.post('/retention/preview', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const rule = await db.get<any>("SELECT * FROM retention_rules WHERE organization_id = ? AND category = 'applications'", [auth.org.id]);
  const days = Number(rule?.retention_days || auth.org.default_retention_days);
  const cutoff = Date.now() - days * 86400_000;
  const row = await db.get<any>(
    'SELECT COUNT(*) AS n FROM applications WHERE organization_id = ? AND applied_at < ? AND anonymized_at IS NULL',
    [auth.org.id, cutoff],
  );
  return c.json({ retention_days: days, cutoff, would_anonymise: Number(row?.n || 0) });
});

settingsRouter.post('/retention/run', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const body = await c.req.json().catch(() => ({}));
  if (body.confirm !== true) return fail(c, 400, 'CONFIRM_REQUIRED', 'Confirm that you have reviewed the retention preview.');
  const db = c.get('db');
  const result = await runRetention(c.env, db, auth.org.id);
  await audit(db, auth, 'settings.retention_run', 'organization', auth.org.id, { ...result }, clientIp(c));
  return c.json({ success: true, ...result });
});
