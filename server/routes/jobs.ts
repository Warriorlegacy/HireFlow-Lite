import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, audit, clientIp } from '../auth';
import { isWorkspaceAdmin, jobAccess, canEditJob } from '../permissions';
import { newId } from '../crypto';
import { parseJson, slugify, intOrNull, isoDate, clampString } from '../util';
import type { Db } from '../db';
import type { AuthContext } from '../types';

export const jobsRouter = new Hono<AppEnv>();

const fieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(140),
  type: z.enum(['text', 'textarea', 'url', 'select']),
  required: z.boolean().default(false),
  options: z.array(z.string().max(80)).max(12).optional(),
});

const jobSchema = z.object({
  title: z.string().min(2).max(140),
  slug: z.string().max(80).optional(),
  department: z.string().max(80).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  work_mode: z.enum(['onsite', 'hybrid', 'remote']).default('onsite'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship']).default('full_time'),
  salary_min: z.number().int().nonnegative().optional().nullable(),
  salary_max: z.number().int().nonnegative().optional().nullable(),
  salary_currency: z.string().max(8).default('INR'),
  description: z.string().min(20).max(20000),
  responsibilities: z.string().max(8000).optional().nullable(),
  qualifications: z.string().max(8000).optional().nullable(),
  application_deadline: z.string().optional().nullable(),
  hiring_owner_id: z.string().max(60).optional().nullable(),
  application_fields: z.array(fieldSchema).max(10).default([]),
  privacy_notice_version: z.string().max(40).optional(),
});

async function uniqueSlug(db: Db, orgId: string, desired: string, excludeId?: string) {
  const base = slugify(desired) || 'role';
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const row = await db.get<any>(
      'SELECT id FROM jobs WHERE organization_id = ? AND slug = ? AND id <> ?',
      [orgId, candidate, excludeId || ''],
    );
    if (!row) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

jobsRouter.use('*', requireAuth());

jobsRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const status = c.req.query('status');
  const params: unknown[] = [auth.org.id];
  let where = 'j.organization_id = ?';

  if (!isWorkspaceAdmin(auth)) {
    if (auth.membership.role === 'interviewer') {
      where += ` AND j.id IN (
        SELECT i.job_id FROM interviews i
        JOIN interview_participants p ON p.interview_id = i.id
        WHERE p.user_id = ?
      )`;
      params.push(auth.user.id);
    } else {
      where += ` AND (j.hiring_owner_id = ? OR j.id IN (SELECT job_id FROM job_memberships WHERE user_id = ?))`;
      params.push(auth.user.id, auth.user.id);
    }
  }
  if (status && ['draft', 'published', 'closed', 'archived'].includes(status)) {
    where += ' AND j.status = ?';
    params.push(status);
  }

  const rows = await db.all<any>(
    `SELECT j.*, u.full_name AS hiring_owner_name,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'active') AS active_applications,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'active' AND a.stage_id = 'stg_new') AS new_applications,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS total_applications,
            (SELECT COUNT(*) FROM interviews i WHERE i.job_id = j.id AND i.status = 'scheduled' AND i.start_at >= ?) AS upcoming_interviews
       FROM jobs j
       LEFT JOIN users u ON u.id = j.hiring_owner_id
      WHERE ${where}
      ORDER BY CASE j.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END, j.created_at DESC`,
    [Date.now(), ...params],
  );
  return c.json({ jobs: rows.map((j) => ({ ...j, application_fields: parseJson(j.application_fields_json, []) })) });
});

jobsRouter.post('/', async (c) => {
  const auth = c.get('auth')!;
  if (!isWorkspaceAdmin(auth) && auth.membership.role !== 'recruiter') {
    return fail(c, 403, 'FORBIDDEN', 'Only owners, admins, and recruiters can create roles.');
  }
  const body = await c.req.json().catch(() => null);
  const parsed = jobSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(c, 400, 'INVALID_INPUT', first?.message || 'Check the job details and try again.');
  }
  const data = parsed.data;
  if (data.salary_min !== null && data.salary_max !== null && data.salary_min !== undefined && data.salary_max !== undefined && data.salary_min > data.salary_max) {
    return fail(c, 422, 'INVALID_RANGE', 'Minimum salary cannot be higher than maximum salary.');
  }
  const db = c.get('db');
  const now = Date.now();
  const id = newId('job');
  const slug = await uniqueSlug(db, auth.org.id, data.slug || data.title);
  const ownerId = data.hiring_owner_id || auth.user.id;

  await db.run(
    `INSERT INTO jobs (id, organization_id, slug, title, department, location, work_mode, employment_type,
       salary_min, salary_max, salary_currency, description, responsibilities, qualifications, application_deadline,
       hiring_owner_id, status, privacy_notice_version, application_fields_json, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    [
      id, auth.org.id, slug, data.title.trim(), data.department || null, data.location || null, data.work_mode,
      data.employment_type, intOrNull(data.salary_min), intOrNull(data.salary_max), data.salary_currency || 'INR',
      data.description.trim(), data.responsibilities || null, data.qualifications || null, isoDate(data.application_deadline),
      ownerId, data.privacy_notice_version || auth.org.privacy_notice_version,
      JSON.stringify(data.application_fields || []), auth.user.id, now, now,
    ],
  );
  await db.run(
    'INSERT OR IGNORE INTO job_memberships (id, organization_id, job_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [newId('jm'), auth.org.id, id, ownerId, 'hiring_manager', now],
  );
  await audit(db, auth, 'job.created', 'job', id, { title: data.title, status: 'draft' }, clientIp(c));
  const job = await db.get<any>('SELECT * FROM jobs WHERE id = ?', [id]);
  return c.json({ job: { ...job, application_fields: parseJson(job.application_fields_json, []) } }, 201);
});

async function loadJobDetail(db: Db, auth: AuthContext, id: string) {
  const access = await jobAccess(db, auth, id);
  if (access.level === 'none') return null;
  if (auth.membership.role === 'interviewer') return null;
  const job = access.job;
  const [team, stages, template, items, counts] = await Promise.all([
    db.all<any>(
      `SELECT jm.id, jm.role, jm.user_id, u.full_name, u.email
         FROM job_memberships jm JOIN users u ON u.id = jm.user_id
        WHERE jm.job_id = ? ORDER BY jm.role, u.full_name`,
      [id],
    ),
    db.all<any>('SELECT * FROM pipeline_stages WHERE organization_id = ? ORDER BY position', [auth.org.id]),
    db.get<any>('SELECT * FROM scorecard_templates WHERE job_id = ? AND organization_id = ? ORDER BY created_at LIMIT 1', [id, auth.org.id]),
    db.all<any>(
      `SELECT si.* FROM scorecard_items si
        JOIN scorecard_templates st ON st.id = si.template_id
       WHERE st.job_id = ? AND si.organization_id = ? ORDER BY si.position`,
      [id, auth.org.id],
    ),
    db.get<any>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN stage_id = 'stg_new' AND status = 'active' THEN 1 ELSE 0 END) AS new_count
         FROM applications WHERE job_id = ? AND organization_id = ?`,
      [id, auth.org.id],
    ),
  ]);
  const owner = job.hiring_owner_id
    ? await db.get<any>('SELECT id, full_name, email FROM users WHERE id = ?', [job.hiring_owner_id])
    : null;
  return {
    job: { ...job, application_fields: parseJson(job.application_fields_json, []) },
    team,
    stages,
    scorecard: template ? { ...template, items: items.map((i: any) => ({ ...i, anchors: parseJson(i.anchors_json, {}) })) } : null,
    counts: counts || { total: 0, active: 0, new_count: 0 },
    hiring_owner: owner,
    access: access.level,
  };
}

jobsRouter.get('/:id', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const detail = await loadJobDetail(db, auth, c.req.param('id'));
  if (!detail) return fail(c, 404, 'NOT_FOUND', 'Role not found or not accessible.');
  return c.json(detail);
});

jobsRouter.patch('/:id', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  if (!(await canEditJob(db, auth, id))) return fail(c, 403, 'FORBIDDEN', 'You cannot edit this role.');
  const body = await c.req.json().catch(() => null);
  const parsed = jobSchema.partial().safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Check the job details.');
  const data = parsed.data;
  const existing = await db.get<any>('SELECT * FROM jobs WHERE id = ? AND organization_id = ?', [id, auth.org.id]);
  if (!existing) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  if (existing.status === 'archived') return fail(c, 409, 'ARCHIVED', 'Archived roles cannot be edited.');

  if (data.salary_min != null && data.salary_max != null && data.salary_min > data.salary_max) {
    return fail(c, 422, 'INVALID_RANGE', 'Minimum salary cannot be higher than maximum salary.');
  }
  const slug = data.slug ? await uniqueSlug(db, auth.org.id, data.slug, id) : existing.slug;
  const fields = data.application_fields !== undefined ? JSON.stringify(data.application_fields) : existing.application_fields_json;
  await db.run(
    `UPDATE jobs SET title = ?, slug = ?, department = ?, location = ?, work_mode = ?, employment_type = ?,
       salary_min = ?, salary_max = ?, salary_currency = ?, description = ?, responsibilities = ?, qualifications = ?,
       application_deadline = ?, hiring_owner_id = ?, application_fields_json = ?, privacy_notice_version = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      data.title?.trim() ?? existing.title, slug, data.department ?? existing.department, data.location ?? existing.location,
      data.work_mode ?? existing.work_mode, data.employment_type ?? existing.employment_type,
      data.salary_min !== undefined ? intOrNull(data.salary_min) : existing.salary_min,
      data.salary_max !== undefined ? intOrNull(data.salary_max) : existing.salary_max,
      data.salary_currency ?? existing.salary_currency,
      data.description?.trim() ?? existing.description, data.responsibilities ?? existing.responsibilities,
      data.qualifications ?? existing.qualifications,
      data.application_deadline !== undefined ? isoDate(data.application_deadline) : existing.application_deadline,
      data.hiring_owner_id ?? existing.hiring_owner_id, fields,
      data.privacy_notice_version ?? existing.privacy_notice_version, Date.now(), id, auth.org.id,
    ],
  );
  await audit(db, auth, 'job.updated', 'job', id, { title: data.title || existing.title }, clientIp(c));
  const detail = await loadJobDetail(db, auth, id);
  return c.json(detail);
});

jobsRouter.post('/:id/status', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  if (!(await canEditJob(db, auth, id))) return fail(c, 403, 'FORBIDDEN', 'You cannot change this role.');
  const body = await c.req.json().catch(() => ({}));
  const status = String(body.status || '');
  if (!['draft', 'published', 'closed', 'archived'].includes(status)) {
    return fail(c, 422, 'INVALID_STATUS', 'Unknown job status.');
  }
  const job = await db.get<any>('SELECT * FROM jobs WHERE id = ? AND organization_id = ?', [id, auth.org.id]);
  if (!job) return fail(c, 404, 'NOT_FOUND', 'Role not found.');

  if (status === 'published') {
    if (!job.title || !job.description || job.description.length < 20) {
      return fail(c, 422, 'INCOMPLETE', 'Add a title and a description before publishing.');
    }
    if (job.status === 'archived') return fail(c, 409, 'ARCHIVED', 'Restore the role before publishing.');
  }

  const now = Date.now();
  await db.run(
    `UPDATE jobs SET status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
       closed_at = CASE WHEN ? IN ('closed','archived') THEN ? ELSE NULL END, updated_at = ? WHERE id = ? AND organization_id = ?`,
    [status, status, now, status, now, now, id, auth.org.id],
  );
  await audit(db, auth, `job.${status}`, 'job', id, { from: job.status, to: status }, clientIp(c));
  const updated = await db.get<any>('SELECT * FROM jobs WHERE id = ?', [id]);
  return c.json({ job: { ...updated, application_fields: parseJson(updated.application_fields_json, []) } });
});

// Hiring team ---------------------------------------------------------------
jobsRouter.post('/:id/team', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  if (!(await canEditJob(db, auth, id))) return fail(c, 403, 'FORBIDDEN', 'You cannot manage this hiring team.');
  const body = await c.req.json().catch(() => ({}));
  const userId = String(body.user_id || '');
  const role = String(body.role || 'interviewer');
  if (!['recruiter', 'hiring_manager', 'interviewer'].includes(role)) {
    return fail(c, 422, 'INVALID_ROLE', 'Choose recruiter, hiring manager, or interviewer.');
  }
  const member = await db.get<any>(
    `SELECT m.user_id, u.full_name FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ? AND m.user_id = ? AND m.status = 'active'`,
    [auth.org.id, userId],
  );
  if (!member) return fail(c, 404, 'NOT_FOUND', 'That person is not an active workspace member.');
  const now = Date.now();
  await db.run(
    `INSERT INTO job_memberships (id, organization_id, job_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_id, user_id) DO UPDATE SET role = excluded.role`,
    [newId('jm'), auth.org.id, id, userId, role, now],
  );
  await audit(db, auth, 'job.team_member_added', 'job', id, { user_id: userId, role }, clientIp(c));
  return c.json({ success: true });
});

jobsRouter.delete('/:id/team/:membershipId', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  if (!(await canEditJob(db, auth, id))) return fail(c, 403, 'FORBIDDEN', 'You cannot manage this hiring team.');
  const membership = await db.get<any>('SELECT * FROM job_memberships WHERE id = ? AND job_id = ? AND organization_id = ?', [
    c.req.param('membershipId'), id, auth.org.id,
  ]);
  if (!membership) return fail(c, 404, 'NOT_FOUND', 'Team member not found.');
  const job = await db.get<any>('SELECT hiring_owner_id FROM jobs WHERE id = ?', [id]);
  if (job?.hiring_owner_id === membership.user_id) {
    return fail(c, 409, 'OWNER_REQUIRED', 'Change the hiring owner before removing them from the team.');
  }
  await db.run('DELETE FROM job_memberships WHERE id = ?', [membership.id]);
  await audit(db, auth, 'job.team_member_removed', 'job', id, { user_id: membership.user_id }, clientIp(c));
  return c.json({ success: true });
});

// Scorecard template --------------------------------------------------------
jobsRouter.put('/:id/scorecard', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  if (!(await canEditJob(db, auth, id))) return fail(c, 403, 'FORBIDDEN', 'You cannot edit this scorecard.');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    name: z.string().min(2).max(120),
    description: z.string().max(2000).optional().nullable(),
    items: z.array(z.object({
      id: z.string().max(60).optional(),
      competency: z.string().min(2).max(140),
      description: z.string().max(1200).optional().nullable(),
      anchors: z.record(z.string()).optional(),
    })).min(1).max(12),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'A scorecard needs a name and at least one competency.');

  const now = Date.now();
  let template = await db.get<any>('SELECT * FROM scorecard_templates WHERE job_id = ? AND organization_id = ? ORDER BY created_at LIMIT 1', [id, auth.org.id]);
  if (!template) {
    const tid = newId('sct');
    await db.run('INSERT INTO scorecard_templates (id, organization_id, job_id, name, description, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      tid, auth.org.id, id, parsed.data.name, parsed.data.description || null, now,
    ]);
    template = { id: tid };
  } else {
    await db.run('UPDATE scorecard_templates SET name = ?, description = ? WHERE id = ?', [parsed.data.name, parsed.data.description || null, template.id]);
  }

  const existing = await db.all<any>('SELECT * FROM scorecard_items WHERE template_id = ?', [template.id]);
  const keepIds = new Set(parsed.data.items.map((i) => i.id).filter(Boolean) as string[]);
  for (const old of existing) {
    if (keepIds.has(old.id)) continue;
    const used = await db.get<any>('SELECT id FROM scorecard_responses WHERE item_id = ? LIMIT 1', [old.id]);
    if (used) {
      return fail(c, 409, 'ITEM_IN_USE', `"${old.competency}" has already been scored and cannot be removed.`);
    }
    await db.run('DELETE FROM scorecard_items WHERE id = ?', [old.id]);
  }
  let position = 0;
  for (const item of parsed.data.items) {
    const anchors = JSON.stringify(item.anchors || {});
    if (item.id && existing.some((e) => e.id === item.id)) {
      await db.run('UPDATE scorecard_items SET competency = ?, description = ?, anchors_json = ?, position = ? WHERE id = ?', [
        item.competency, item.description || null, anchors, position, item.id,
      ]);
    } else {
      await db.run(
        'INSERT INTO scorecard_items (id, organization_id, template_id, competency, description, anchors_json, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newId('sci'), auth.org.id, template.id, item.competency, item.description || null, anchors, position, now],
      );
    }
    position++;
  }
  await audit(db, auth, 'job.scorecard_updated', 'job', id, { name: parsed.data.name }, clientIp(c));
  const detail = await loadJobDetail(db, auth, id);
  return c.json(detail);
});

// Close/archive semantics: never hard-delete a role with applications.
jobsRouter.delete('/:id', async (c) => {
  const auth = c.get('auth')!;
  if (!isWorkspaceAdmin(auth)) return fail(c, 403, 'FORBIDDEN', 'Only owners and admins can archive roles.');
  const db = c.get('db');
  const id = c.req.param('id');
  const job = await db.get<any>('SELECT * FROM jobs WHERE id = ? AND organization_id = ?', [id, auth.org.id]);
  if (!job) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  await db.run("UPDATE jobs SET status = 'archived', closed_at = ?, updated_at = ? WHERE id = ?", [Date.now(), Date.now(), id]);
  await audit(db, auth, 'job.archived', 'job', id, {}, clientIp(c));
  return c.json({ success: true, status: 'archived' });
});

// Member directory for team pickers.
jobsRouter.get('/meta/members', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const rows = await db.all<any>(
    `SELECT m.user_id AS id, u.full_name, u.email, m.role, m.title
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ? AND m.status = 'active' ORDER BY u.full_name`,
    [auth.org.id],
  );
  return c.json({ members: rows });
});
