import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, audit, clientIp } from '../auth';
import { canExport, isWorkspaceAdmin, jobAccess } from '../permissions';
import { parseCsv, toCsv } from '../csv';
import { newId } from '../crypto';

export const importExportRouter = new Hono<AppEnv>();
importExportRouter.use('*', requireAuth());

const MAX_IMPORT_ROWS = 300;

importExportRouter.get('/export', async (c) => {
  const auth = c.get('auth')!;
  if (!canExport(auth)) return fail(c, 403, 'FORBIDDEN', 'Your role cannot export candidate data.');
  const db = c.get('db');
  const jobId = c.req.query('job_id');
  const params: unknown[] = [auth.org.id];
  let where = 'a.organization_id = ?';
  if (jobId) {
    const access = await jobAccess(db, auth, jobId);
    if (access.level === 'none' || access.level === 'interview') return fail(c, 403, 'FORBIDDEN', 'No access to that role.');
    where += ' AND a.job_id = ?';
    params.push(jobId);
  } else if (!isWorkspaceAdmin(auth)) {
    where += ' AND (j.hiring_owner_id = ? OR j.id IN (SELECT job_id FROM job_memberships WHERE user_id = ?))';
    params.push(auth.user.id, auth.user.id);
  }

  const rows = await db.all<any>(
    `SELECT a.id, c.full_name, c.email, c.phone, c.location, j.title AS job_title, s.name AS stage_name,
            a.status, a.source, a.source_detail, a.applied_at, a.first_reviewed_at, u.full_name AS owner_name
       FROM applications a JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
       JOIN pipeline_stages s ON s.id = a.stage_id LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE ${where} ORDER BY a.applied_at DESC LIMIT 5000`,
    params,
  );
  const csv = toCsv(
    ['Application', 'Candidate', 'Email', 'Phone', 'Location', 'Role', 'Stage', 'Status', 'Source', 'Source detail', 'Applied at', 'First reviewed at', 'Owner'],
    rows.map((r) => [
      r.id, r.full_name, r.email, r.phone || '', r.location || '', r.job_title, r.stage_name, r.status,
      r.source || '', r.source_detail || '', new Date(r.applied_at).toISOString(),
      r.first_reviewed_at ? new Date(r.first_reviewed_at).toISOString() : '', r.owner_name || '',
    ]),
  );
  await audit(db, auth, 'applications.exported', 'organization', auth.org.id, { rows: rows.length, job_id: jobId || null }, clientIp(c));
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="hireflow-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
});

importExportRouter.post('/import/preview', async (c) => {
  const auth = c.get('auth')!;
  if (!canExport(auth)) return fail(c, 403, 'FORBIDDEN', 'Only recruiters and workspace admins can import candidates.');
  const db = c.get('db');
  let form: any;
  try {
    form = await c.req.parseBody();
  } catch {
    return fail(c, 400, 'INVALID_INPUT', 'Upload a CSV file.');
  }
  const jobId = String(form.job_id || '');
  if (!jobId) return fail(c, 422, 'JOB_REQUIRED', 'Choose the role for this import.');
  const access = await jobAccess(db, auth, jobId);
  if (!['manage', 'edit'].includes(access.level)) return fail(c, 403, 'FORBIDDEN', 'You cannot import into this role.');
  const file = form.file;
  if (!file || typeof file === 'string') return fail(c, 422, 'FILE_REQUIRED', 'Upload a CSV file.');
  if (file.size > 2 * 1024 * 1024) return fail(c, 413, 'FILE_TOO_LARGE', 'CSV must be 2 MB or smaller.');
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return fail(c, 422, 'EMPTY_FILE', 'The CSV has no data rows.');
  if (rows.length - 1 > MAX_IMPORT_ROWS) return fail(c, 422, 'TOO_MANY_ROWS', `Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const index = (name: string) => header.indexOf(name);
  if (index('name') === -1 || index('email') === -1) {
    return fail(c, 422, 'MISSING_COLUMNS', 'The CSV needs at least "name" and "email" columns.');
  }

  const output: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const value = (name: string) => (index(name) >= 0 ? String(row[index(name)] || '').trim() : '');
    const name = value('name').slice(0, 120);
    const email = value('email').toLowerCase().slice(0, 160);
    const errors: string[] = [];
    if (name.length < 2) errors.push('Name is too short.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Email is not valid.');
    let duplicate = false;
    if (!errors.length) {
      const existing = await db.get<any>(
        `SELECT a.id FROM applications a JOIN candidates c ON c.id = a.candidate_id
          WHERE a.organization_id = ? AND a.job_id = ? AND lower(c.email) = ? LIMIT 1`,
        [auth.org.id, jobId, email],
      );
      duplicate = Boolean(existing);
    }
    output.push({
      row: i + 1,
      full_name: name,
      email,
      phone: value('phone').slice(0, 40),
      location: value('location').slice(0, 120),
      linkedin_url: value('linkedin_url').slice(0, 300),
      portfolio_url: value('portfolio_url').slice(0, 300),
      source: value('source').slice(0, 60) || 'import',
      source_detail: value('source_detail').slice(0, 200),
      cover_note: value('cover_note').slice(0, 2000),
      status: errors.length ? 'invalid' : duplicate ? 'duplicate' : 'ready',
      errors,
    });
  }
  const summary = {
    total: output.length,
    ready: output.filter((r) => r.status === 'ready').length,
    duplicate: output.filter((r) => r.status === 'duplicate').length,
    invalid: output.filter((r) => r.status === 'invalid').length,
  };
  return c.json({
    rows: output,
    summary,
    note: 'Duplicates and invalid rows are skipped. Importing does not create consent: confirm you have a lawful basis and record consent separately.',
  });
});

importExportRouter.post('/import/commit', async (c) => {
  const auth = c.get('auth')!;
  if (!canExport(auth)) return fail(c, 403, 'FORBIDDEN', 'Only recruiters and workspace admins can import candidates.');
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  if (!body || body.attest !== true) {
    return fail(c, 422, 'ATTESTATION_REQUIRED', 'Confirm that you may lawfully process these records and will capture consent separately.');
  }
  const jobId = String(body.job_id || '');
  const access = await jobAccess(db, auth, jobId);
  if (!['manage', 'edit'].includes(access.level)) return fail(c, 403, 'FORBIDDEN', 'You cannot import into this role.');
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_IMPORT_ROWS) : [];
  if (!rows.length) return fail(c, 422, 'NO_ROWS', 'No rows to import.');

  const stage = await db.get<any>("SELECT * FROM pipeline_stages WHERE organization_id = ? AND key = 'new'", [auth.org.id]);
  if (!stage) return fail(c, 500, 'NOT_CONFIGURED', 'No intake stage configured.');
  const now = Date.now();
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const name = String(row.full_name || '').trim().slice(0, 120);
    const email = String(row.email || '').trim().toLowerCase().slice(0, 160);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      skipped++;
      continue;
    }
    const duplicate = await db.get<any>(
      `SELECT a.id FROM applications a JOIN candidates c ON c.id = a.candidate_id
        WHERE a.organization_id = ? AND a.job_id = ? AND lower(c.email) = ? LIMIT 1`,
      [auth.org.id, jobId, email],
    );
    if (duplicate) {
      skipped++;
      continue;
    }
    const candidateId = newId('cand');
    const applicationId = newId('app');
    await db.batch([
      {
        sql: 'INSERT INTO candidates (id, organization_id, full_name, email, phone, location, linkedin_url, portfolio_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [candidateId, auth.org.id, name, email, String(row.phone || '').slice(0, 40) || null, String(row.location || '').slice(0, 120) || null,
          String(row.linkedin_url || '').slice(0, 300) || null, String(row.portfolio_url || '').slice(0, 300) || null, now, now],
      },
      {
        sql: `INSERT INTO applications (id, organization_id, job_id, candidate_id, stage_id, status, source, source_detail, cover_note, owner_user_id, applied_at, stage_entered_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
        params: [applicationId, auth.org.id, jobId, candidateId, stage.id, String(row.source || 'import').slice(0, 60),
          String(row.source_detail || 'CSV import').slice(0, 200), String(row.cover_note || '').slice(0, 2000) || null,
          auth.user.id, now, now, now],
      },
      {
        sql: 'INSERT INTO candidate_consents (id, organization_id, application_id, purpose, notice_version, granted, source, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
        params: [newId('con'), auth.org.id, applicationId, 'application_review', auth.org.privacy_notice_version, 'import_no_consent_recorded', now],
      },
      {
        sql: 'INSERT INTO stage_events (id, organization_id, application_id, from_stage_id, to_stage_id, actor_user_id, reason, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
        params: [newId('sev'), auth.org.id, applicationId, stage.id, auth.user.id, 'Imported from CSV', now],
      },
    ]);
    imported++;
  }
  await audit(db, auth, 'applications.imported', 'job', jobId, { imported, skipped }, clientIp(c));
  return c.json({ success: true, imported, skipped, total: rows.length });
});
