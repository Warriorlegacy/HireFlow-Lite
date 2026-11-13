import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { fail, clientIp } from '../auth';
import { rateLimit } from '../ratelimit';
import { newId, randomToken, sha256Hex, sha256BytesHex } from '../crypto';
import { validateResume, storeResume, deleteResume, MAX_RESUME_BYTES } from '../files';
import { parseJson } from '../util';
import type { Db } from '../db';
import type { Context } from 'hono';

export const publicRouter = new Hono<AppEnv>();

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function orgBySlug(db: Db, slug: string) {
  return db.get<any>('SELECT * FROM organizations WHERE slug = ?', [slug]);
}

async function primaryOrganization(db: Db) {
  return (
    (await db.get<any>(
      `SELECT o.* FROM organizations o
        WHERE EXISTS (SELECT 1 FROM jobs j WHERE j.organization_id = o.id AND j.status = 'published')
        ORDER BY o.created_at LIMIT 1`,
    )) || (await db.get<any>('SELECT * FROM organizations ORDER BY created_at LIMIT 1'))
  );
}

function publicOrg(org: any) {
  return {
    name: org.name,
    slug: org.slug,
    careers_intro: org.careers_intro,
    website: org.website,
    privacy_notice_version: org.privacy_notice_version,
    privacy_notice_url: org.privacy_notice_url,
  };
}

// ---------------------------------------------------------------------------
// Careers index and job detail
// ---------------------------------------------------------------------------
publicRouter.get('/organizations/:slug', async (c) => {
  const db = c.get('db');
  const org = await orgBySlug(db, c.req.param('slug'));
  if (!org) return fail(c, 404, 'NOT_FOUND', 'Careers page not found.');
  const jobs = await db.all<any>(
    `SELECT id, slug, title, department, location, work_mode, employment_type, salary_min, salary_max, salary_currency,
            description, application_deadline, published_at
       FROM jobs WHERE organization_id = ? AND status = 'published'
       ORDER BY published_at DESC, created_at DESC`,
    [org.id],
  );
  const today = new Date().toISOString().slice(0, 10);
  return c.json({
    organization: publicOrg(org),
    jobs: jobs.map((j) => ({ ...j, accepting_applications: !j.application_deadline || j.application_deadline >= today })),
  });
});

async function jobDetail(c: Context<AppEnv>, org: any, jobSlug: string) {
  const db = c.get('db');
  const job = await db.get<any>(
    `SELECT * FROM jobs WHERE organization_id = ? AND slug = ? AND status IN ('published','closed')`,
    [org.id, jobSlug],
  );
  if (!job) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  const today = new Date().toISOString().slice(0, 10);
  return c.json({
    organization: publicOrg(org),
    job: {
      ...job,
      application_fields: parseJson(job.application_fields_json, []),
      accepting_applications: job.status === 'published' && (!job.application_deadline || job.application_deadline >= today),
    },
  });
}

publicRouter.get('/organizations/:slug/jobs/:jobSlug', async (c) => {
  const db = c.get('db');
  const org = await orgBySlug(db, c.req.param('slug'));
  if (!org) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  return jobDetail(c, org, c.req.param('jobSlug'));
});

publicRouter.get('/careers', async (c) => {
  const db = c.get('db');
  const org = await primaryOrganization(db);
  if (!org) return fail(c, 404, 'NOT_FOUND', 'No careers page is configured.');
  const jobs = await db.all<any>(
    `SELECT slug, title, department, location, work_mode, employment_type, salary_min, salary_max, salary_currency,
            description, application_deadline, published_at
       FROM jobs WHERE organization_id = ? AND status = 'published'
       ORDER BY published_at DESC, created_at DESC`,
    [org.id],
  );
  const today = new Date().toISOString().slice(0, 10);
  return c.json({
    organization: publicOrg(org),
    jobs: jobs.map((j) => ({ ...j, accepting_applications: !j.application_deadline || j.application_deadline >= today })),
  });
});

publicRouter.get('/careers/:jobSlug', async (c) => {
  const db = c.get('db');
  const org = await primaryOrganization(db);
  if (!org) return fail(c, 404, 'NOT_FOUND', 'No careers page is configured.');
  return jobDetail(c, org, c.req.param('jobSlug'));
});

// ---------------------------------------------------------------------------
// Application intake
// ---------------------------------------------------------------------------
async function createApplication(c: Context<AppEnv>, org: any, job: any) {
  const db = c.get('db');
  if (job.status !== 'published') return fail(c, 409, 'NOT_ACCEPTING', 'This role is not accepting applications.');
  const today = new Date().toISOString().slice(0, 10);
  if (job.application_deadline && job.application_deadline < today) {
    return fail(c, 409, 'DEADLINE_PASSED', 'The application deadline for this role has passed.');
  }

  let form: any;
  try {
    form = await c.req.parseBody();
  } catch {
    return fail(c, 400, 'INVALID_INPUT', 'Submit the application form again.');
  }

  if (String(form.website || '').trim()) return fail(c, 400, 'SPAM_REJECTED', 'The form could not be submitted.');
  const startedAt = Number(form.started_at || 0);
  if (startedAt && Date.now() - startedAt < 2500) {
    return fail(c, 400, 'SPAM_REJECTED', 'The form was submitted too quickly. Please review your details and try again.');
  }

  const fullName = String(form.full_name || '').trim().slice(0, 120);
  const email = String(form.email || '').trim().toLowerCase().slice(0, 160);
  const phone = String(form.phone || '').trim().slice(0, 40) || null;
  const location = String(form.location || '').trim().slice(0, 120) || null;
  const linkedin = String(form.linkedin_url || '').trim().slice(0, 300) || null;
  const portfolio = String(form.portfolio_url || '').trim().slice(0, 300) || null;
  const coverNote = String(form.cover_note || '').trim().slice(0, 4000) || null;
  const consent = String(form.consent || '') === 'yes' || String(form.consent || '') === 'on';

  if (fullName.length < 2) return fail(c, 422, 'VALIDATION', 'Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(c, 422, 'VALIDATION', 'Enter a valid email address.');
  if (!consent) return fail(c, 422, 'CONSENT_REQUIRED', 'Please confirm that you have read the privacy notice.');
  for (const url of [linkedin, portfolio]) {
    if (url && !/^https?:\/\//i.test(url)) return fail(c, 422, 'VALIDATION', 'Links must start with http:// or https://.');
  }

  const duplicate = await db.get<any>(
    `SELECT a.id FROM applications a JOIN candidates c ON c.id = a.candidate_id
      WHERE a.organization_id = ? AND a.job_id = ? AND lower(c.email) = ? LIMIT 1`,
    [org.id, job.id, email],
  );
  if (duplicate) {
    return fail(c, 409, 'DUPLICATE_APPLICATION', 'An application for this role already exists for this email. Use your candidate status link to check it, or contact the hiring team.');
  }

  const fields = parseJson<any[]>(job.application_fields_json, []);
  const answers: { key: string; question: string; answer: string }[] = [];
  for (const field of fields) {
    const value = String(form[`field_${field.key}`] || '').trim().slice(0, 3000);
    if (field.required && !value) return fail(c, 422, 'VALIDATION', `"${field.label}" is required.`);
    if (value) answers.push({ key: field.key, question: field.label, answer: value });
  }

  const resume = form.resume;
  if (!resume || typeof resume === 'string') return fail(c, 422, 'RESUME_REQUIRED', 'Attach your resume as a PDF or DOCX file.');
  const bytes = new Uint8Array(await resume.arrayBuffer());
  if (bytes.length > MAX_RESUME_BYTES) return fail(c, 413, 'FILE_TOO_LARGE', 'Resume must be 5 MB or smaller.');
  const check = validateResume(resume.name || 'resume.pdf', resume.type || '', bytes);
  if (!check.ok) return fail(c, 422, 'INVALID_FILE', check.reason || 'Resume could not be accepted.');

  const now = Date.now();
  const candidateId = newId('cand');
  const applicationId = newId('app');
  const fileId = newId('res');
  const checksum = await sha256BytesHex(bytes);
  const stored = await storeResume(c.env, db, {
    orgId: org.id, applicationId, fileId, filename: resume.name || 'resume.pdf',
    mimeType: check.mimeType!, bytes,
  });

  const stage = await db.get<any>("SELECT * FROM pipeline_stages WHERE organization_id = ? AND key = 'new'", [org.id]);
  if (!stage) return fail(c, 500, 'NOT_CONFIGURED', 'This workspace has no intake stage configured.');

  const source = String(form.source || 'careers_page').trim().slice(0, 60);
  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: 'INSERT INTO candidates (id, organization_id, full_name, email, phone, location, linkedin_url, portfolio_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [candidateId, org.id, fullName, email, phone, location, linkedin, portfolio, now, now],
    },
    {
      sql: `INSERT INTO applications (id, organization_id, job_id, candidate_id, stage_id, status, source, source_detail, cover_note, resume_file_id, applied_at, stage_entered_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
      params: [applicationId, org.id, job.id, candidateId, stage.id, source, 'Careers page', coverNote, fileId, now, now, now],
    },
    {
      sql: 'INSERT INTO resume_files (id, organization_id, application_id, storage_backend, storage_key, original_filename, mime_type, size_bytes, checksum_sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [fileId, org.id, applicationId, stored.backend, stored.key, String(resume.name || 'resume.pdf').slice(0, 160), check.mimeType, bytes.length, checksum, now],
    },
    {
      sql: 'INSERT INTO candidate_consents (id, organization_id, application_id, purpose, notice_version, granted, source, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      params: [newId('con'), org.id, applicationId, 'application_review', job.privacy_notice_version || org.privacy_notice_version, 'careers_form', now],
    },
    {
      sql: 'INSERT INTO stage_events (id, organization_id, application_id, from_stage_id, to_stage_id, actor_user_id, reason, created_at) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)',
      params: [newId('sev'), org.id, applicationId, stage.id, 'Application received', now],
    },
    {
      sql: 'INSERT INTO source_attributions (id, organization_id, application_id, source, detail, utm_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [newId('src'), org.id, applicationId, source, 'Careers page', JSON.stringify({ utm_source: form.utm_source || null, utm_medium: form.utm_medium || null, utm_campaign: form.utm_campaign || null }), now],
    },
    ...answers.map((a) => ({
      sql: 'INSERT INTO application_answers (id, organization_id, application_id, field_key, question, answer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [newId('ans'), org.id, applicationId, a.key, a.question, a.answer, now],
    })),
  ];

  const template = await db.get<any>("SELECT * FROM communication_templates WHERE organization_id = ? AND key = 'acknowledgement'", [org.id]);
  if (template) {
    const vars = { candidate_name: fullName, job_title: job.title, retention_days: String(org.default_retention_days) };
    statements.push({
      sql: `INSERT INTO communication_events (id, organization_id, application_id, template_id, channel, to_email, subject, body, status, provider, error, created_at)
            VALUES (?, ?, ?, ?, 'email', ?, ?, ?, 'not_configured', NULL, ?, ?)`,
      params: [newId('com'), org.id, applicationId, template.id, email, renderTemplate(template.subject, vars), renderTemplate(template.body, vars),
        'No email provider configured. Message saved to the application log.', now],
    });
  }

  const portalToken = randomToken(32);
  statements.push({
    sql: 'INSERT INTO candidate_portal_tokens (id, organization_id, application_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    params: [newId('cpt'), org.id, applicationId, await sha256Hex(portalToken), now + 90 * 86400_000, now],
  });

  try {
    await db.batch(statements);
  } catch (err) {
    await deleteResume(c.env, db, { storage_backend: stored.backend, storage_key: stored.key }).catch(() => {});
    throw err;
  }
  const base = c.env.APP_URL || new URL(c.req.url).origin;
  return c.json({
    success: true,
    application_reference: `APP-${applicationId.slice(-6).toUpperCase()}`,
    portal_url: `${base}/portal/${portalToken}`,
    message: 'Application received. The hiring team will review it and reply by email.',
  }, 201);
}

publicRouter.post('/organizations/:slug/jobs/:jobSlug/apply', async (c) => {
  const db = c.get('db');
  const limited = await rateLimit(db, `apply:${clientIp(c)}`, 8, 60 * 60_000);
  if (!limited.allowed) return fail(c, 429, 'RATE_LIMITED', 'Too many applications from this connection. Try again later.');
  const org = await orgBySlug(db, c.req.param('slug'));
  if (!org) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  const job = await db.get<any>('SELECT * FROM jobs WHERE organization_id = ? AND slug = ?', [org.id, c.req.param('jobSlug')]);
  if (!job) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  return createApplication(c, org, job);
});

publicRouter.post('/careers/:jobSlug/apply', async (c) => {
  const db = c.get('db');
  const limited = await rateLimit(db, `apply:${clientIp(c)}`, 8, 60 * 60_000);
  if (!limited.allowed) return fail(c, 429, 'RATE_LIMITED', 'Too many applications from this connection. Try again later.');
  const org = await primaryOrganization(db);
  if (!org) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  const job = await db.get<any>('SELECT * FROM jobs WHERE organization_id = ? AND slug = ?', [org.id, c.req.param('jobSlug')]);
  if (!job) return fail(c, 404, 'NOT_FOUND', 'Role not found.');
  return createApplication(c, org, job);
});

/** Public job feed for discovery and smoke checks. */
publicRouter.get('/jobs', async (c) => {
  const db = c.get('db');
  const rows = await db.all<any>(
    `SELECT o.slug AS organization_slug, o.name AS organization_name, j.slug, j.title, j.department, j.location, j.work_mode, j.published_at
       FROM jobs j JOIN organizations o ON o.id = j.organization_id
      WHERE j.status = 'published' ORDER BY j.published_at DESC LIMIT 100`,
  );
  return c.json({ jobs: rows });
});
