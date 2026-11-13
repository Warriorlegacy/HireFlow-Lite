import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, clientIp, auditSystem } from '../auth';
import { rateLimit } from '../ratelimit';
import { sha256Hex, newId } from '../crypto';
import type { Context } from 'hono';

export const portalRouter = new Hono<AppEnv>();

async function resolveToken(c: Context<AppEnv>): Promise<{ token: any; application: any } | null> {
  const raw = c.req.param('token');
  if (!raw || raw.length < 20) return null;
  const db = c.get('db');
  const hash = await sha256Hex(raw);
  const token = await db.get<any>('SELECT * FROM candidate_portal_tokens WHERE token_hash = ?', [hash]);
  if (!token) return null;
  if (token.revoked_at) return { token: null, application: null };
  if (token.expires_at < Date.now()) return { token: null, application: null };
  const application = await db.get<any>(
    `SELECT a.*, j.title AS job_title, j.location AS job_location, j.work_mode, j.status AS job_status,
            c.full_name AS candidate_name, c.email AS candidate_email,
            s.name AS stage_name, s.kind AS stage_kind, s.position AS stage_position,
            o.name AS org_name, o.slug AS org_slug, o.privacy_notice_version, o.privacy_notice_url, o.default_retention_days
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN pipeline_stages s ON s.id = a.stage_id
       JOIN organizations o ON o.id = a.organization_id
      WHERE a.id = ? AND a.organization_id = ?`,
    [token.application_id, token.organization_id],
  );
  if (!application) return null;
  await db.run('UPDATE candidate_portal_tokens SET last_used_at = ? WHERE id = ?', [Date.now(), token.id]);
  return { token, application };
}

function portalHeaders(c: any) {
  c.header('cache-control', 'no-store, private');
  c.header('referrer-policy', 'no-referrer');
  c.header('x-robots-tag', 'noindex, nofollow, noarchive');
}

portalRouter.use('*', async (c, next) => {
  const db = c.get('db');
  const limited = await rateLimit(db, `portal:${clientIp(c)}`, 120, 60 * 60_000);
  if (!limited.allowed) return fail(c, 429, 'RATE_LIMITED', 'Too many requests. Try again later.');
  await next();
  portalHeaders(c);
});

portalRouter.get('/:token', async (c) => {
  const resolved = await resolveToken(c);
  if (!resolved || !resolved.application) return fail(c, 404, 'NOT_FOUND', 'This status link is not valid or has expired.');
  const db = c.get('db');
  const app = resolved.application;

  const [timeline, interviews, messages, consent, requests] = await Promise.all([
    db.all<any>(
      `SELECT e.created_at, ts.name AS to_stage_name, ts.kind AS to_stage_kind
         FROM stage_events e JOIN pipeline_stages ts ON ts.id = e.to_stage_id
        WHERE e.application_id = ? ORDER BY e.created_at ASC`,
      [app.id],
    ),
    db.all<any>(
      `SELECT title, format, start_at, end_at, timezone, location, meeting_url, candidate_notes, status
         FROM interviews WHERE application_id = ? ORDER BY start_at ASC`,
      [app.id],
    ),
    db.all<any>(
      `SELECT subject, body, status, created_at, sent_at FROM communication_events
        WHERE application_id = ? ORDER BY created_at DESC LIMIT 50`,
      [app.id],
    ),
    db.get<any>('SELECT granted, notice_version, created_at, withdrawn_at FROM candidate_consents WHERE application_id = ? ORDER BY created_at DESC LIMIT 1', [app.id]),
    db.all<any>('SELECT request_type, status, created_at, resolution_note FROM deletion_requests WHERE application_id = ? ORDER BY created_at DESC', [app.id]),
  ]);

  return c.json({
    organization: {
      name: app.org_name,
      slug: app.org_slug,
      privacy_notice_version: app.privacy_notice_version,
      privacy_notice_url: app.privacy_notice_url,
      retention_days: app.default_retention_days,
    },
    application: {
      reference: `APP-${String(app.id).slice(-6).toUpperCase()}`,
      candidate_name: app.candidate_name,
      candidate_email: app.candidate_email,
      job_title: app.job_title,
      job_location: app.job_location,
      work_mode: app.work_mode,
      stage_name: app.stage_name,
      stage_kind: app.stage_kind,
      status: app.status,
      applied_at: app.applied_at,
      withdrawn_at: app.withdrawn_at,
    },
    timeline,
    interviews,
    messages,
    consent,
    deletion_requests: requests,
  });
});

portalRouter.post('/:token/withdraw', async (c) => {
  const resolved = await resolveToken(c);
  if (!resolved || !resolved.application) return fail(c, 404, 'NOT_FOUND', 'This status link is not valid or has expired.');
  const db = c.get('db');
  const app = resolved.application;
  if (app.status === 'withdrawn') return fail(c, 409, 'ALREADY_WITHDRAWN', 'This application is already withdrawn.');
  if (app.status === 'archived') return fail(c, 409, 'CLOSED', 'This application is closed.');
  if (app.anonymized_at) return fail(c, 409, 'CLOSED', 'This application record is closed.');

  const body = await c.req.json().catch(() => ({}));
  const reason = String(body.reason || '').trim().slice(0, 500) || 'Withdrawn by candidate';
  const stage = await db.get<any>("SELECT * FROM pipeline_stages WHERE organization_id = ? AND key = 'withdrawn'", [app.organization_id]);
  if (!stage) return fail(c, 500, 'NOT_CONFIGURED', 'Withdrawal is not available right now.');
  const now = Date.now();
  await db.batch([
    {
      sql: "UPDATE applications SET stage_id = ?, status = 'withdrawn', withdrawn_at = ?, stage_entered_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      params: [stage.id, now, now, now, app.id, app.organization_id],
    },
    {
      sql: 'INSERT INTO stage_events (id, organization_id, application_id, from_stage_id, to_stage_id, actor_user_id, reason, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)',
      params: [newId('sev'), app.organization_id, app.id, app.stage_id, stage.id, reason, now],
    },
    {
      sql: 'UPDATE candidate_consents SET withdrawn_at = ? WHERE application_id = ? AND withdrawn_at IS NULL',
      params: [now, app.id],
    },
  ]);
  await auditSystem(db, app.organization_id, 'candidate.withdrew_application', 'application', app.id, { reason }, clientIp(c));
  return c.json({ success: true, stage: 'Withdrawn' });
});

portalRouter.post('/:token/consent-withdraw', async (c) => {
  const resolved = await resolveToken(c);
  if (!resolved || !resolved.application) return fail(c, 404, 'NOT_FOUND', 'This status link is not valid or has expired.');
  const db = c.get('db');
  const app = resolved.application;
  const now = Date.now();
  await db.run('UPDATE candidate_consents SET withdrawn_at = ? WHERE application_id = ? AND withdrawn_at IS NULL', [now, app.id]);
  await auditSystem(db, app.organization_id, 'candidate.consent_withdrawn', 'application', app.id, {}, clientIp(c));
  return c.json({ success: true });
});

portalRouter.post('/:token/data-request', async (c) => {
  const resolved = await resolveToken(c);
  if (!resolved || !resolved.application) return fail(c, 404, 'NOT_FOUND', 'This status link is not valid or has expired.');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    request_type: z.enum(['delete', 'correct']),
    note: z.string().min(4).max(1500),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Tell us what you need changed or deleted.');
  const db = c.get('db');
  const app = resolved.application;
  const now = Date.now();
  const rid = newId('dr');
  await db.run(
    'INSERT INTO deletion_requests (id, organization_id, application_id, request_type, status, note, requested_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [rid, app.organization_id, app.id, parsed.data.request_type, 'open', parsed.data.note.trim(), 'candidate', now],
  );
  await auditSystem(db, app.organization_id, 'candidate.data_request', 'application', app.id, { request_type: parsed.data.request_type }, clientIp(c));
  return c.json({ success: true, request_id: rid, message: 'Your request has been recorded. The hiring team will respond within the retention policy window.' }, 201);
});

/** ICS download for scheduled interviews the candidate can see. */
portalRouter.get('/:token/calendar.ics', async (c) => {
  const resolved = await resolveToken(c);
  if (!resolved || !resolved.application) return fail(c, 404, 'NOT_FOUND', 'This status link is not valid or has expired.');
  const db = c.get('db');
  const app = resolved.application;
  const interviews = await db.all<any>(
    "SELECT * FROM interviews WHERE application_id = ? AND status = 'scheduled' ORDER BY start_at",
    [app.id],
  );
  if (!interviews.length) return fail(c, 404, 'NOT_FOUND', 'No scheduled interviews.');

  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s: string) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HireFlow Lite//Candidate//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  ];
  for (const i of interviews) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${i.id}@hireflow`,
      `DTSTAMP:${fmt(Date.now())}`,
      `DTSTART:${fmt(i.start_at)}`,
      `DTEND:${fmt(i.end_at)}`,
      `SUMMARY:${escape(i.title)} - ${escape(app.job_title)}`,
      `DESCRIPTION:${escape(i.candidate_notes || 'Interview with the hiring team.')}`,
      `LOCATION:${escape(i.meeting_url || i.location || i.format)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  await auditSystem(db, app.organization_id, 'candidate.calendar_download', 'application', app.id, {}, clientIp(c));
  return new Response(lines.join('\r\n'), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="interviews.ics"',
      'cache-control': 'no-store',
    },
  });
});
