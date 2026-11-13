import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, audit, clientIp } from '../auth';
import { applicationAccess, canExport, isWorkspaceAdmin, jobAccess } from '../permissions';
import { newId, randomToken, sha256Hex } from '../crypto';
import { readResume } from '../files';
import { parseJson } from '../util';
import type { Db } from '../db';
import type { AuthContext } from '../types';

export const applicationsRouter = new Hono<AppEnv>();

applicationsRouter.use('*', requireAuth());

const listQuery = z.object({
  job_id: z.string().max(60).optional(),
  stage_id: z.string().max(60).optional(),
  status: z.enum(['active', 'hired', 'rejected', 'withdrawn', 'archived', 'all']).optional(),
  source: z.string().max(60).optional(),
  q: z.string().max(120).optional(),
  owner: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).max(2000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['newest', 'oldest', 'stage_age']).default('newest'),
});

applicationsRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  if (auth.membership.role === 'interviewer') {
    return fail(c, 403, 'FORBIDDEN', 'Interviewers access candidates through assigned interview packets only.');
  }
  const db = c.get('db');
  const parsed = listQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Invalid filter.');
  const f = parsed.data;

  const params: unknown[] = [auth.org.id];
  let where = 'a.organization_id = ?';

  if (!isWorkspaceAdmin(auth)) {
    where += ` AND (j.hiring_owner_id = ? OR j.id IN (SELECT job_id FROM job_memberships WHERE user_id = ?))`;
    params.push(auth.user.id, auth.user.id);
  }
  if (f.job_id) {
    if (!(await jobAccess(db, auth, f.job_id))) return fail(c, 403, 'FORBIDDEN', 'No access to that role.');
    where += ' AND a.job_id = ?';
    params.push(f.job_id);
  }
  if (f.stage_id) {
    where += ' AND a.stage_id = ?';
    params.push(f.stage_id);
  }
  if (f.status && f.status !== 'all') {
    where += ' AND a.status = ?';
    params.push(f.status);
  }
  if (f.source) {
    where += ' AND a.source = ?';
    params.push(f.source);
  }
  if (f.owner) {
    where += ' AND a.owner_user_id = ?';
    params.push(f.owner);
  }
  if (f.q) {
    where += ' AND (c.full_name LIKE ? OR c.email LIKE ? OR j.title LIKE ?)';
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like);
  }

  const countRow = await db.get<any>(
    `SELECT COUNT(*) AS total FROM applications a JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id WHERE ${where}`,
    params,
  );
  const total = Number(countRow?.total || 0);
  const offset = (f.page - 1) * f.limit;
  const order = f.sort === 'oldest' ? 'a.applied_at ASC' : f.sort === 'stage_age' ? 'a.stage_entered_at ASC' : 'a.applied_at DESC';

  const rows = await db.all<any>(
    `SELECT a.id, a.job_id, a.stage_id, a.status, a.source, a.applied_at, a.stage_entered_at,
            a.first_reviewed_at, a.updated_at, a.owner_user_id,
            c.id AS candidate_id, c.full_name AS candidate_name, c.email AS candidate_email, c.location AS candidate_location,
            j.title AS job_title, j.slug AS job_slug, j.department,
            s.name AS stage_name, s.kind AS stage_kind, s.position AS stage_position,
            u.full_name AS owner_name,
            (SELECT COUNT(*) FROM interviews i WHERE i.application_id = a.id) AS interview_count,
            (SELECT COUNT(*) FROM feedback f WHERE f.application_id = a.id) AS feedback_count
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       JOIN pipeline_stages s ON s.id = a.stage_id
       LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [...params, f.limit, offset],
  );

  return c.json({
    applications: rows,
    pagination: { page: f.page, limit: f.limit, total, pages: Math.max(1, Math.ceil(total / f.limit)) },
  });
});

async function loadDetail(db: Db, auth: AuthContext, id: string) {
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return { notFound: true as const };
  if (access.level === 'none') return { forbidden: true as const };
  const app = access.application;

  if (access.level === 'interview') {
    const interviews = await db.all<any>(
      `SELECT i.* FROM interviews i JOIN interview_participants p ON p.interview_id = i.id
        WHERE i.application_id = ? AND p.user_id = ? ORDER BY i.start_at DESC`,
      [id, auth.user.id],
    );
    const template = await db.get<any>('SELECT * FROM scorecard_templates WHERE job_id = ? ORDER BY created_at LIMIT 1', [app.job_id]);
    const items = template
      ? await db.all<any>('SELECT * FROM scorecard_items WHERE template_id = ? ORDER BY position', [template.id])
      : [];
    const myScorecards = await db.all<any>('SELECT * FROM scorecards WHERE application_id = ? AND interviewer_user_id = ?', [id, auth.user.id]);
    return {
      access: 'interview' as const,
      application: {
        id: app.id, job_id: app.job_id, job_title: app.job_title, stage_id: app.stage_id, status: app.status,
        candidate_name: app.candidate_name, applied_at: app.applied_at,
      },
      interviews,
      scorecard_template: template ? { ...template, items: items.map((i: any) => ({ ...i, anchors: parseJson(i.anchors_json, {}) })) } : null,
      my_scorecards: myScorecards,
    };
  }

  // Record first review the first time a recruiter or manager opens the file.
  if (!app.first_reviewed_at && (auth.membership.role === 'recruiter' || auth.membership.role === 'hiring_manager')) {
    const now = Date.now();
    await db.run('UPDATE applications SET first_reviewed_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    app.first_reviewed_at = now;
  }

  const [candidate, answers, consent, resume, history, interviews, feedback, communications, portalToken, deletion, stages, owner] = await Promise.all([
    db.get<any>('SELECT * FROM candidates WHERE id = ? AND organization_id = ?', [app.candidate_id, auth.org.id]),
    db.all<any>('SELECT * FROM application_answers WHERE application_id = ? ORDER BY created_at', [id]),
    db.get<any>('SELECT * FROM candidate_consents WHERE application_id = ? ORDER BY created_at DESC LIMIT 1', [id]),
    db.get<any>('SELECT id, original_filename, mime_type, size_bytes, created_at, deleted_at FROM resume_files WHERE application_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [id]),
    db.all<any>(
      `SELECT e.*, fs.name AS from_stage_name, ts.name AS to_stage_name, u.full_name AS actor_name
         FROM stage_events e
         LEFT JOIN pipeline_stages fs ON fs.id = e.from_stage_id
         LEFT JOIN pipeline_stages ts ON ts.id = e.to_stage_id
         LEFT JOIN users u ON u.id = e.actor_user_id
        WHERE e.application_id = ? ORDER BY e.created_at ASC`,
      [id],
    ),
    db.all<any>(
      `SELECT i.*, (SELECT COUNT(*) FROM interview_participants p WHERE p.interview_id = i.id) AS participant_count,
              (SELECT COUNT(*) FROM scorecards s WHERE s.interview_id = i.id) AS scorecard_count
         FROM interviews i WHERE i.application_id = ? ORDER BY i.start_at DESC`,
      [id],
    ),
    db.all<any>(
      `SELECT f.*, u.full_name AS author_name FROM feedback f JOIN users u ON u.id = f.author_user_id
        WHERE f.application_id = ? AND (f.visibility = 'hiring_team' OR f.author_user_id = ?)
        ORDER BY f.created_at DESC`,
      [id, auth.user.id],
    ),
    db.all<any>(
      `SELECT ce.*, u.full_name AS created_by_name FROM communication_events ce
        LEFT JOIN users u ON u.id = ce.created_by_user_id
        WHERE ce.application_id = ? ORDER BY ce.created_at DESC`,
      [id],
    ),
    db.get<any>('SELECT id, expires_at, revoked_at, last_used_at, created_at FROM candidate_portal_tokens WHERE application_id = ? ORDER BY created_at DESC LIMIT 1', [id]),
    db.all<any>('SELECT * FROM deletion_requests WHERE application_id = ? ORDER BY created_at DESC', [id]),
    db.all<any>('SELECT * FROM pipeline_stages WHERE organization_id = ? ORDER BY position', [auth.org.id]),
    app.owner_user_id ? db.get<any>('SELECT id, full_name, email FROM users WHERE id = ?', [app.owner_user_id]) : null,
  ]);

  const stage = stages.find((s: any) => s.id === app.stage_id);
  const interviewIds = interviews.map((i: any) => i.id);
  let participants: any[] = [];
  let scorecards: any[] = [];
  if (interviewIds.length) {
    const placeholders = interviewIds.map(() => '?').join(',');
    participants = await db.all<any>(
      `SELECT p.*, u.full_name, u.email FROM interview_participants p JOIN users u ON u.id = p.user_id
        WHERE p.interview_id IN (${placeholders}) ORDER BY p.role, u.full_name`,
      interviewIds,
    );
    scorecards = await db.all<any>(
      `SELECT s.*, u.full_name AS interviewer_name FROM scorecards s JOIN users u ON u.id = s.interviewer_user_id
        WHERE s.interview_id IN (${placeholders}) ORDER BY s.created_at DESC`,
      interviewIds,
    );
  }

  return {
    access: access.level,
    application: {
      ...app,
      stage_name: stage?.name || null,
      stage_kind: stage?.kind || null,
      candidate,
      answers,
      consent,
      resume,
      portal_token: portalToken || null,
      deletion_requests: deletion,
    },
    history,
    interviews: interviews.map((i: any) => ({
      ...i,
      participants: participants.filter((p) => p.interview_id === i.id),
      scorecards: scorecards.filter((s) => s.interview_id === i.id),
    })),
    feedback,
    communications,
    stages,
    owner,
  };
}

applicationsRouter.get('/:id', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const detail = await loadDetail(db, auth, c.req.param('id'));
  if ('notFound' in detail) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if ('forbidden' in detail) return fail(c, 403, 'FORBIDDEN', 'You do not have access to this application.');
  return c.json(detail);
});

applicationsRouter.post('/:id/stage', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (!['manage', 'edit', 'view'].includes(access.level)) {
    return fail(c, 403, 'FORBIDDEN', 'You cannot move this application.');
  }
  if (access.level === 'view' && auth.membership.role !== 'hiring_manager') {
    return fail(c, 403, 'FORBIDDEN', 'You cannot move this application.');
  }
  const body = await c.req.json().catch(() => ({}));
  const stageId = String(body.stage_id || '');
  const reason = String(body.reason || '').trim().slice(0, 500);
  const stage = await db.get<any>('SELECT * FROM pipeline_stages WHERE id = ? AND organization_id = ?', [stageId, auth.org.id]);
  if (!stage) return fail(c, 422, 'INVALID_STAGE', 'Choose a stage from this workspace.');
  const app = access.application;
  if (app.stage_id === stageId) return fail(c, 409, 'NO_CHANGE', 'The application is already in that stage.');
  if (app.status === 'archived' || app.anonymized_at) return fail(c, 409, 'READ_ONLY', 'This application is read-only.');

  const now = Date.now();
  const nextStatus = stage.kind === 'hired' ? 'hired' : stage.kind === 'rejected' ? 'rejected' : stage.kind === 'withdrawn' ? 'withdrawn' : 'active';
  if (stage.kind === 'rejected' && !reason) {
    return fail(c, 422, 'REASON_REQUIRED', 'Add a short reason for the rejection. Candidates may ask for it.');
  }

  const statements = [
    {
      sql: 'UPDATE applications SET stage_id = ?, status = ?, stage_entered_at = ?, rejection_reason = ?, withdrawn_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?',
      params: [
        stageId, nextStatus, now,
        stage.kind === 'rejected' ? reason : null,
        stage.kind === 'withdrawn' ? now : null,
        now, id, auth.org.id,
      ],
    },
    {
      sql: 'INSERT INTO stage_events (id, organization_id, application_id, from_stage_id, to_stage_id, actor_user_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      params: [newId('sev'), auth.org.id, id, app.stage_id, stageId, auth.user.id, reason || null, now],
    },
  ];
  await db.batch(statements);
  await audit(db, auth, 'application.stage_changed', 'application', id, { from: app.stage_id, to: stageId, reason }, clientIp(c));
  return c.json({ success: true, stage: { id: stage.id, name: stage.name, kind: stage.kind }, status: nextStatus });
});

applicationsRouter.patch('/:id', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (!['manage', 'edit'].includes(access.level)) return fail(c, 403, 'FORBIDDEN', 'You cannot edit this application.');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    owner_user_id: z.string().max(60).nullable().optional(),
    source: z.string().max(60).nullable().optional(),
    source_detail: z.string().max(200).nullable().optional(),
    candidate_location: z.string().max(120).nullable().optional(),
    candidate_phone: z.string().max(40).nullable().optional(),
    candidate_linkedin_url: z.string().max(300).nullable().optional(),
    candidate_portfolio_url: z.string().max(300).nullable().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Check the fields and try again.');
  const d = parsed.data;
  const now = Date.now();
  if (d.owner_user_id !== undefined && d.owner_user_id !== null) {
    const member = await db.get<any>('SELECT user_id FROM memberships WHERE organization_id = ? AND user_id = ? AND status = ?', [auth.org.id, d.owner_user_id, 'active']);
    if (!member) return fail(c, 422, 'INVALID_OWNER', 'Choose an active workspace member as owner.');
  }
  if (d.owner_user_id !== undefined) {
    await db.run('UPDATE applications SET owner_user_id = ?, updated_at = ? WHERE id = ?', [d.owner_user_id, now, id]);
  }
  if (d.source !== undefined || d.source_detail !== undefined) {
    await db.run('UPDATE applications SET source = COALESCE(?, source), source_detail = COALESCE(?, source_detail), updated_at = ? WHERE id = ?', [
      d.source ?? null, d.source_detail ?? null, now, id,
    ]);
  }
  const candidateUpdates: string[] = [];
  const candidateParams: unknown[] = [];
  if (d.candidate_location !== undefined) { candidateUpdates.push('location = ?'); candidateParams.push(d.candidate_location); }
  if (d.candidate_phone !== undefined) { candidateUpdates.push('phone = ?'); candidateParams.push(d.candidate_phone); }
  if (d.candidate_linkedin_url !== undefined) { candidateUpdates.push('linkedin_url = ?'); candidateParams.push(d.candidate_linkedin_url); }
  if (d.candidate_portfolio_url !== undefined) { candidateUpdates.push('portfolio_url = ?'); candidateParams.push(d.candidate_portfolio_url); }
  if (candidateUpdates.length) {
    candidateParams.push(now, access.application.candidate_id, auth.org.id);
    await db.run(`UPDATE candidates SET ${candidateUpdates.join(', ')}, updated_at = ? WHERE id = ? AND organization_id = ?`, candidateParams);
  }
  await audit(db, auth, 'application.updated', 'application', id, { fields: Object.keys(d) }, clientIp(c));
  return c.json({ success: true });
});

applicationsRouter.post('/:id/feedback', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (access.level === 'none' || access.level === 'interview') {
    return fail(c, 403, 'FORBIDDEN', 'Use the interview scorecard to leave structured feedback.');
  }
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ body: z.string().min(4).max(4000), visibility: z.enum(['hiring_team', 'private']).default('hiring_team') });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Write a note of at least a few words.');
  const now = Date.now();
  const fid = newId('fb');
  await db.run('INSERT INTO feedback (id, organization_id, application_id, author_user_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    fid, auth.org.id, id, auth.user.id, parsed.data.body.trim(), parsed.data.visibility, now,
  ]);
  await audit(db, auth, 'application.feedback_added', 'application', id, { visibility: parsed.data.visibility }, clientIp(c));
  return c.json({ success: true, feedback: { id: fid, body: parsed.data.body.trim(), visibility: parsed.data.visibility, created_at: now, author_name: auth.user.full_name } }, 201);
});

applicationsRouter.post('/:id/portal-link', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (access.level !== 'manage' && access.level !== 'edit') return fail(c, 403, 'FORBIDDEN', 'You cannot issue a candidate link.');
  const app = access.application;
  if (app.anonymized_at) return fail(c, 409, 'READ_ONLY', 'This application has been anonymised.');

  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + 90 * 86400_000;
  await db.run('UPDATE candidate_portal_tokens SET revoked_at = ? WHERE application_id = ? AND revoked_at IS NULL', [now, id]);
  await db.run(
    'INSERT INTO candidate_portal_tokens (id, organization_id, application_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [newId('cpt'), auth.org.id, id, hash, expiresAt, now],
  );
  await audit(db, auth, 'application.portal_link_issued', 'application', id, {}, clientIp(c));
  const base = c.env.APP_URL || new URL(c.req.url).origin;
  return c.json({ url: `${base}/portal/${token}`, expires_at: expiresAt });
});

applicationsRouter.post('/:id/portal-link/revoke', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (access.level !== 'manage' && access.level !== 'edit') return fail(c, 403, 'FORBIDDEN', 'You cannot revoke this candidate link.');
  await db.run('UPDATE candidate_portal_tokens SET revoked_at = ? WHERE application_id = ? AND revoked_at IS NULL', [Date.now(), id]);
  await audit(db, auth, 'application.portal_link_revoked', 'application', id, {}, clientIp(c));
  return c.json({ success: true });
});

// Secure resume download. Never public, never cached, always audited.
applicationsRouter.get('/:id/resume', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Resume not found.');
  if (access.level === 'none') return fail(c, 403, 'FORBIDDEN', 'You do not have access to this resume.');
  if (access.level === 'interview') return fail(c, 403, 'FORBIDDEN', 'Resumes are not shared in the interview packet.');
  const file = await db.get<any>('SELECT * FROM resume_files WHERE application_id = ? AND organization_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [id, auth.org.id]);
  if (!file) return fail(c, 404, 'NOT_FOUND', 'No resume is attached.');
  const bytes = await readResume(c.env, db, file);
  if (!bytes) return fail(c, 404, 'NOT_FOUND', 'Resume data is unavailable.');
  await audit(db, auth, 'resume.downloaded', 'application', id, { file_id: file.id }, clientIp(c));
  const safeName = String(file.original_filename).replace(/["\r\n]/g, '');
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      'content-type': file.mime_type,
      'content-disposition': `attachment; filename="${safeName}"`,
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
});

applicationsRouter.get('/:id/export', async (c) => {
  const auth = c.get('auth')!;
  if (!canExport(auth)) return fail(c, 403, 'FORBIDDEN', 'Your role cannot export candidate data.');
  const db = c.get('db');
  const id = c.req.param('id');
  const access = await applicationAccess(db, auth, id);
  if (!access.application) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  if (access.level === 'none' || access.level === 'interview') return fail(c, 403, 'FORBIDDEN', 'You cannot export this application.');
  const app = access.application;
  const answers = await db.all<any>('SELECT question, answer FROM application_answers WHERE application_id = ?', [id]);
  const { toCsv } = await import('../csv');
  const csv = toCsv(
    ['Application', 'Candidate', 'Job', 'Stage', 'Status', 'Source', 'Applied', 'Answers'],
    [[app.id, app.candidate_name, app.job_title, app.stage_id, app.status, app.source || '', new Date(app.applied_at).toISOString(), answers.map((a) => `${a.question}: ${a.answer}`).join(' | ')]],
  );
  await audit(db, auth, 'application.exported', 'application', id, {}, clientIp(c));
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="application-${id}.csv"`,
      'cache-control': 'no-store',
    },
  });
});
