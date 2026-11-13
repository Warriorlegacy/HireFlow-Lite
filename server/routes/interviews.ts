import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, audit, clientIp } from '../auth';
import { isWorkspaceAdmin, jobAccess } from '../permissions';
import { newId } from '../crypto';
import { parseJson } from '../util';
import type { Db } from '../db';
import type { AuthContext } from '../types';

export const interviewsRouter = new Hono<AppEnv>();
interviewsRouter.use('*', requireAuth());

async function loadInterview(db: Db, auth: AuthContext, id: string) {
  const interview = await db.get<any>(
    `SELECT i.*, a.candidate_id, a.stage_id, a.status AS application_status,
            c.full_name AS candidate_name, c.email AS candidate_email,
            j.title AS job_title, j.slug AS job_slug, j.department
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = i.job_id
      WHERE i.id = ? AND i.organization_id = ?`,
    [id, auth.org.id],
  );
  if (!interview) return { notFound: true as const };
  const participant = await db.get<any>('SELECT * FROM interview_participants WHERE interview_id = ? AND user_id = ?', [id, auth.user.id]);
  if (isWorkspaceAdmin(auth)) return { interview, access: 'manage' as const, participant };
  if (participant) return { interview, access: 'participant' as const, participant };

  const access = await jobAccess(db, auth, interview.job_id);
  if (access.level === 'manage' || access.level === 'edit' || access.level === 'view') {
    return { interview, access: access.level, participant };
  }
  return { interview, access: 'none' as const, participant };
}

interviewsRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const from = Number(c.req.query('from') || 0);
  const to = Number(c.req.query('to') || 0);
  const params: unknown[] = [auth.org.id];
  let where = 'i.organization_id = ?';

  if (!isWorkspaceAdmin(auth)) {
    if (auth.membership.role === 'interviewer') {
      where += ' AND i.id IN (SELECT interview_id FROM interview_participants WHERE user_id = ?)';
      params.push(auth.user.id);
    } else {
      where += ` AND (j.hiring_owner_id = ? OR i.job_id IN (SELECT job_id FROM job_memberships WHERE user_id = ?))`;
      params.push(auth.user.id, auth.user.id);
    }
  }
  if (from) {
    where += ' AND i.end_at >= ?';
    params.push(from);
  }
  if (to) {
    where += ' AND i.start_at <= ?';
    params.push(to);
  }

  const rows = await db.all<any>(
    `SELECT i.*, c.full_name AS candidate_name, j.title AS job_title,
            (SELECT COUNT(*) FROM interview_participants p WHERE p.interview_id = i.id) AS participant_count,
            (SELECT COUNT(*) FROM scorecards s WHERE s.interview_id = i.id) AS scorecard_count
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = i.job_id
      WHERE ${where}
      ORDER BY i.start_at ASC LIMIT 200`,
    params,
  );
  return c.json({ interviews: rows });
});

const interviewSchema = z.object({
  application_id: z.string().min(5),
  title: z.string().min(2).max(140),
  format: z.enum(['video', 'phone', 'onsite']).default('video'),
  start_at: z.number().int(),
  end_at: z.number().int(),
  timezone: z.string().max(60).default('Asia/Kolkata'),
  location: z.string().max(240).optional().nullable(),
  meeting_url: z.string().max(500).optional().nullable(),
  candidate_notes: z.string().max(2000).optional().nullable(),
  participants: z.array(z.object({ user_id: z.string().min(3), role: z.enum(['lead', 'interviewer', 'shadow']).default('interviewer') })).max(8).default([]),
});

interviewsRouter.post('/', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = interviewSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Check the interview details.');
  const d = parsed.data;
  if (d.end_at <= d.start_at) return fail(c, 422, 'INVALID_TIME', 'The end time must be after the start time.');
  if (d.end_at - d.start_at > 8 * 3600_000) return fail(c, 422, 'INVALID_TIME', 'An interview block cannot exceed eight hours.');

  const application = await db.get<any>('SELECT * FROM applications WHERE id = ? AND organization_id = ?', [d.application_id, auth.org.id]);
  if (!application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (application.status === 'withdrawn' || application.anonymized_at) {
    return fail(c, 409, 'READ_ONLY', 'Cannot schedule an interview for a closed application.');
  }
  const access = await jobAccess(db, auth, application.job_id);
  if (!['manage', 'edit'].includes(access.level) && !(access.level === 'view' && auth.membership.role === 'hiring_manager')) {
    return fail(c, 403, 'FORBIDDEN', 'You cannot schedule interviews for this role.');
  }

  for (const p of d.participants) {
    const member = await db.get<any>('SELECT user_id FROM memberships WHERE organization_id = ? AND user_id = ? AND status = ?', [auth.org.id, p.user_id, 'active']);
    if (!member) return fail(c, 422, 'INVALID_PARTICIPANT', 'Every interviewer must be an active workspace member.');
  }

  const now = Date.now();
  const id = newId('int');
  await db.run(
    `INSERT INTO interviews (id, organization_id, job_id, application_id, title, format, start_at, end_at, timezone, location, meeting_url, candidate_notes, status, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`,
    [id, auth.org.id, application.job_id, d.application_id, d.title.trim(), d.format, d.start_at, d.end_at, d.timezone,
      d.location || null, d.meeting_url || null, d.candidate_notes || null, auth.user.id, now, now],
  );
  for (const p of d.participants) {
    await db.run('INSERT OR IGNORE INTO interview_participants (id, organization_id, interview_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      newId('ip'), auth.org.id, id, p.user_id, p.role, now,
    ]);
  }
  await audit(db, auth, 'interview.scheduled', 'interview', id, { application_id: d.application_id, start_at: d.start_at }, clientIp(c));
  return c.json({ success: true, id }, 201);
});

interviewsRouter.get('/:id', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const loaded = await loadInterview(db, auth, c.req.param('id'));
  if ('notFound' in loaded) return fail(c, 404, 'NOT_FOUND', 'Interview not found.');
  if (loaded.access === 'none') return fail(c, 403, 'FORBIDDEN', 'You are not assigned to this interview.');
  const interview = loaded.interview;

  const [participants, template, items, scorecards, responses, application] = await Promise.all([
    db.all<any>('SELECT p.*, u.full_name, u.email FROM interview_participants p JOIN users u ON u.id = p.user_id WHERE p.interview_id = ? ORDER BY p.role', [interview.id]),
    db.get<any>('SELECT * FROM scorecard_templates WHERE job_id = ? AND organization_id = ? ORDER BY created_at LIMIT 1', [interview.job_id, auth.org.id]),
    db.all<any>(
      `SELECT si.* FROM scorecard_items si JOIN scorecard_templates st ON st.id = si.template_id
        WHERE st.job_id = ? AND si.organization_id = ? ORDER BY si.position`,
      [interview.job_id, auth.org.id],
    ),
    db.all<any>(
      `SELECT s.*, u.full_name AS interviewer_name FROM scorecards s JOIN users u ON u.id = s.interviewer_user_id
        WHERE s.interview_id = ? ORDER BY s.created_at`,
      [interview.id],
    ),
    db.all<any>(
      `SELECT r.* FROM scorecard_responses r JOIN scorecards s ON s.id = r.scorecard_id WHERE s.interview_id = ?`,
      [interview.id],
    ),
    db.get<any>(
      `SELECT a.id, a.stage_id, a.status, a.applied_at, a.cover_note, a.source,
              c.full_name, c.email, c.location, c.portfolio_url, c.linkedin_url,
              (SELECT id FROM resume_files rf WHERE rf.application_id = a.id AND rf.deleted_at IS NULL ORDER BY rf.created_at DESC LIMIT 1) AS resume_id
         FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE a.id = ?`,
      [interview.application_id],
    ),
  ]);

  // Interviewers see only their own submitted scorecard; the hiring team sees all.
  const visibleScorecards = loaded.access === 'participant'
    ? scorecards.filter((s: any) => s.interviewer_user_id === auth.user.id)
    : scorecards;

  const minimalCandidate = loaded.access === 'participant'
    ? { full_name: interview.candidate_name, job_title: interview.job_title }
    : application;

  return c.json({
    access: loaded.access,
    interview,
    participants,
    candidate: minimalCandidate,
    scorecard_template: template ? { ...template, items: items.map((i: any) => ({ ...i, anchors: parseJson(i.anchors_json, {}) })) } : null,
    scorecards: visibleScorecards.map((s: any) => ({
      ...s,
      responses: responses.filter((r) => r.scorecard_id === s.id),
    })),
    my_participation: loaded.participant || null,
  });
});

interviewsRouter.patch('/:id', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const loaded = await loadInterview(db, auth, c.req.param('id'));
  if ('notFound' in loaded) return fail(c, 404, 'NOT_FOUND', 'Interview not found.');
  if (!['manage', 'edit', 'view'].includes(loaded.access) && loaded.access !== 'participant') {
    return fail(c, 403, 'FORBIDDEN', 'You cannot edit this interview.');
  }
  if (loaded.access === 'participant' && auth.membership.role !== 'hiring_manager') {
    return fail(c, 403, 'FORBIDDEN', 'Only the hiring team can change interview logistics.');
  }
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    title: z.string().min(2).max(140).optional(),
    format: z.enum(['video', 'phone', 'onsite']).optional(),
    start_at: z.number().int().optional(),
    end_at: z.number().int().optional(),
    timezone: z.string().max(60).optional(),
    location: z.string().max(240).nullable().optional(),
    meeting_url: z.string().max(500).nullable().optional(),
    candidate_notes: z.string().max(2000).nullable().optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
    participants: z.array(z.object({ user_id: z.string().min(3), role: z.enum(['lead', 'interviewer', 'shadow']) })).max(8).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Check the interview details.');
  const d = parsed.data;
  const i = loaded.interview;
  const start = d.start_at ?? i.start_at;
  const end = d.end_at ?? i.end_at;
  if (end <= start) return fail(c, 422, 'INVALID_TIME', 'The end time must be after the start time.');

  await db.run(
    `UPDATE interviews SET title = ?, format = ?, start_at = ?, end_at = ?, timezone = ?, location = ?, meeting_url = ?, candidate_notes = ?, status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [d.title?.trim() ?? i.title, d.format ?? i.format, start, end, d.timezone ?? i.timezone,
      d.location !== undefined ? d.location : i.location, d.meeting_url !== undefined ? d.meeting_url : i.meeting_url,
      d.candidate_notes !== undefined ? d.candidate_notes : i.candidate_notes, d.status ?? i.status, Date.now(), i.id, auth.org.id],
  );
  if (d.participants) {
    for (const p of d.participants) {
      const member = await db.get<any>('SELECT user_id FROM memberships WHERE organization_id = ? AND user_id = ? AND status = ?', [auth.org.id, p.user_id, 'active']);
      if (!member) return fail(c, 422, 'INVALID_PARTICIPANT', 'Every interviewer must be an active workspace member.');
    }
    await db.run('DELETE FROM interview_participants WHERE interview_id = ?', [i.id]);
    for (const p of d.participants) {
      await db.run('INSERT INTO interview_participants (id, organization_id, interview_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        newId('ip'), auth.org.id, i.id, p.user_id, p.role, Date.now(),
      ]);
    }
  }
  await audit(db, auth, d.start_at || d.end_at ? 'interview.rescheduled' : 'interview.updated', 'interview', i.id, {}, clientIp(c));
  return c.json({ success: true });
});

const scorecardSchema = z.object({
  overall: z.enum(['strong_yes', 'yes', 'no', 'strong_no']),
  summary: z.string().max(4000).optional().nullable(),
  responses: z.array(z.object({
    item_id: z.string().min(3),
    rating: z.number().int().min(1).max(5),
    evidence: z.string().max(2000).optional().nullable(),
  })).min(1).max(20),
});

interviewsRouter.post('/:id/scorecard', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const loaded = await loadInterview(db, auth, c.req.param('id'));
  if ('notFound' in loaded) return fail(c, 404, 'NOT_FOUND', 'Interview not found.');
  if (!loaded.participant) return fail(c, 403, 'FORBIDDEN', 'Only assigned interviewers can submit a scorecard.');
  if (loaded.interview.status === 'cancelled') return fail(c, 409, 'CANCELLED', 'This interview was cancelled.');

  const body = await c.req.json().catch(() => null);
  const parsed = scorecardSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Rate every competency and choose an overall recommendation.');
  const d = parsed.data;

  const validItems = await db.all<any>(
    `SELECT si.id FROM scorecard_items si JOIN scorecard_templates st ON st.id = si.template_id
      WHERE st.job_id = ? AND si.organization_id = ?`,
    [loaded.interview.job_id, auth.org.id],
  );
  const validIds = new Set(validItems.map((i) => i.id));
  for (const r of d.responses) {
    if (!validIds.has(r.item_id)) return fail(c, 422, 'INVALID_ITEM', 'One of the competencies is not part of this role scorecard.');
  }

  const now = Date.now();
  const existing = await db.get<any>('SELECT * FROM scorecards WHERE interview_id = ? AND interviewer_user_id = ?', [loaded.interview.id, auth.user.id]);
  let scorecardId = existing?.id;
  if (existing) {
    await db.run('UPDATE scorecards SET overall = ?, summary = ?, submitted_at = ? WHERE id = ?', [d.overall, d.summary || null, now, existing.id]);
    await db.run('DELETE FROM scorecard_responses WHERE scorecard_id = ?', [existing.id]);
  } else {
    scorecardId = newId('sc');
    await db.run(
      'INSERT INTO scorecards (id, organization_id, interview_id, application_id, interviewer_user_id, overall, summary, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [scorecardId, auth.org.id, loaded.interview.id, loaded.interview.application_id, auth.user.id, d.overall, d.summary || null, now, now],
    );
  }
  for (const r of d.responses) {
    await db.run(
      'INSERT INTO scorecard_responses (id, organization_id, scorecard_id, item_id, rating, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId('sr'), auth.org.id, scorecardId, r.item_id, r.rating, r.evidence || null, now],
    );
  }
  await audit(db, auth, 'scorecard.submitted', 'interview', loaded.interview.id, { overall: d.overall }, clientIp(c));
  return c.json({ success: true, scorecard_id: scorecardId });
});

interviewsRouter.get('/:id/calendar.ics', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const loaded = await loadInterview(db, auth, c.req.param('id'));
  if ('notFound' in loaded) return fail(c, 404, 'NOT_FOUND', 'Interview not found.');
  if (loaded.access === 'none') return fail(c, 403, 'FORBIDDEN', 'You are not assigned to this interview.');
  const i = loaded.interview;
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s: string) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HireFlow Lite//Interview//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${i.id}@hireflow`, `DTSTAMP:${fmt(Date.now())}`, `DTSTART:${fmt(i.start_at)}`, `DTEND:${fmt(i.end_at)}`,
    `SUMMARY:${escape(i.title)} - ${escape(i.candidate_name)}`, `DESCRIPTION:${escape(i.candidate_notes || '')}`,
    `LOCATION:${escape(i.meeting_url || i.location || i.format)}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  await audit(db, auth, 'interview.calendar_download', 'interview', i.id, {}, clientIp(c));
  return new Response(ics, {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="interview.ics"', 'cache-control': 'no-store' },
  });
});
