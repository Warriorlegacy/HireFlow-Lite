import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, audit, clientIp } from '../auth';
import { applicationAccess, canManageSettings } from '../permissions';
import { sendEmail, logCommunication } from '../email';
import type { Db } from '../db';

export const communicationsRouter = new Hono<AppEnv>();
communicationsRouter.use('*', requireAuth());

function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function buildVars(db: Db, org: any, applicationId: string, options: { interviewId?: string; statusMessage?: string }) {
  const row = await db.get<any>(
    `SELECT a.id, a.stage_id, c.full_name AS candidate_name, c.email AS candidate_email,
            j.title AS job_title, s.name AS stage_name
       FROM applications a JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id JOIN pipeline_stages s ON s.id = a.stage_id
      WHERE a.id = ? AND a.organization_id = ?`,
    [applicationId, org.id],
  );
  if (!row) return null;
  let interviewTitle = '';
  let interviewTime = '';
  let interviewFormat = '';
  if (options.interviewId) {
    const i = await db.get<any>('SELECT * FROM interviews WHERE id = ? AND application_id = ? AND organization_id = ?', [options.interviewId, applicationId, org.id]);
    if (i) {
      interviewTitle = i.title;
      interviewTime = new Date(i.start_at).toLocaleString('en-IN', { timeZone: i.timezone, dateStyle: 'medium', timeStyle: 'short' });
      interviewFormat = i.format;
    }
  }
  return {
    candidate_name: row.candidate_name,
    candidate_email: row.candidate_email,
    job_title: row.job_title,
    company_name: org.name,
    stage_name: row.stage_name,
    status_message: options.statusMessage || `Your application is currently in the ${row.stage_name} stage.`,
    interview_title: interviewTitle,
    interview_time: interviewTime,
    interview_format: interviewFormat,
    retention_days: String(org.default_retention_days || 365),
  };
}

communicationsRouter.get('/templates', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const templates = await db.all<any>('SELECT * FROM communication_templates WHERE organization_id = ? ORDER BY name', [auth.org.id]);
  return c.json({
    templates,
    can_edit: canManageSettings(auth) || auth.membership.role === 'recruiter',
    email_configured: Boolean(c.env.RESEND_API_KEY),
  });
});

const templateSchema = z.object({
  name: z.string().min(2).max(120),
  subject: z.string().min(2).max(300),
  body: z.string().min(10).max(12000),
});

communicationsRouter.put('/templates/:key', async (c) => {
  const auth = c.get('auth')!;
  if (auth.membership.role === 'interviewer' || auth.membership.role === 'hiring_manager') {
    return fail(c, 403, 'FORBIDDEN', 'Only recruiters and workspace admins can edit message templates.');
  }
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Check the subject and body.');
  const key = String(c.req.param('key')).slice(0, 60);
  const existing = await db.get<any>('SELECT * FROM communication_templates WHERE organization_id = ? AND key = ?', [auth.org.id, key]);
  const now = Date.now();
  if (existing) {
    await db.run('UPDATE communication_templates SET name = ?, subject = ?, body = ?, updated_at = ? WHERE id = ?', [
      parsed.data.name, parsed.data.subject, parsed.data.body, now, existing.id,
    ]);
  } else {
    await db.run('INSERT INTO communication_templates (id, organization_id, key, name, subject, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      `tpl_${key}`, auth.org.id, key, parsed.data.name, parsed.data.subject, parsed.data.body, now, now,
    ]);
  }
  await audit(db, auth, 'communication.template_updated', 'template', key, {}, clientIp(c));
  const updated = await db.get<any>('SELECT * FROM communication_templates WHERE organization_id = ? AND key = ?', [auth.org.id, key]);
  return c.json({ template: updated });
});

const previewSchema = z.object({
  application_id: z.string().min(3),
  template_key: z.string().max(60).optional(),
  interview_id: z.string().max(60).optional(),
  subject: z.string().max(300).optional(),
  body: z.string().max(12000).optional(),
  status_message: z.string().max(500).optional(),
});

communicationsRouter.post('/preview', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Check the message details.');
  const access = await applicationAccess(db, auth, parsed.data.application_id);
  if (!access.application || !['manage', 'edit'].includes(access.level)) {
    return fail(c, 403, 'FORBIDDEN', 'You cannot prepare messages for this application.');
  }
  let subject = parsed.data.subject || '';
  let text = parsed.data.body || '';
  if (parsed.data.template_key) {
    const tpl = await db.get<any>('SELECT * FROM communication_templates WHERE organization_id = ? AND key = ?', [auth.org.id, parsed.data.template_key]);
    if (!tpl) return fail(c, 404, 'NOT_FOUND', 'Template not found.');
    subject = tpl.subject;
    text = tpl.body;
  }
  const vars = await buildVars(db, auth.org, parsed.data.application_id, {
    interviewId: parsed.data.interview_id,
    statusMessage: parsed.data.status_message,
  });
  if (!vars) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  return c.json({
    to: vars.candidate_email,
    subject: render(subject, vars),
    body: render(text, vars),
    email_configured: Boolean(c.env.RESEND_API_KEY),
    delivery_note: c.env.RESEND_API_KEY
      ? 'Sending will call the configured email provider. Delivery is recorded only when the provider accepts the message.'
      : 'No email provider is configured. The message will be saved to the application log and marked as not sent.',
  });
});

const sendSchema = previewSchema.extend({
  application_id: z.string().min(3),
  confirm: z.literal(true),
});

communicationsRouter.post('/send', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Preview the message and confirm before sending.');
  const d = parsed.data;

  const access = await applicationAccess(db, auth, d.application_id);
  if (!access.application || !['manage', 'edit'].includes(access.level)) {
    return fail(c, 403, 'FORBIDDEN', 'You cannot send messages for this application.');
  }
  if (access.application.status === 'withdrawn' || access.application.anonymized_at) {
    return fail(c, 409, 'READ_ONLY', 'This application is closed. Messages cannot be sent.');
  }

  let subject = d.subject || '';
  let text = d.body || '';
  let templateId: string | null = null;
  if (d.template_key) {
    const tpl = await db.get<any>('SELECT * FROM communication_templates WHERE organization_id = ? AND key = ?', [auth.org.id, d.template_key]);
    if (!tpl) return fail(c, 404, 'NOT_FOUND', 'Template not found.');
    subject = tpl.subject;
    text = tpl.body;
    templateId = tpl.id;
  }
  if (subject.trim().length < 2 || text.trim().length < 10) {
    return fail(c, 422, 'INVALID_INPUT', 'A message needs a subject and a body.');
  }

  const vars = await buildVars(db, auth.org, d.application_id, { interviewId: d.interview_id, statusMessage: d.status_message });
  if (!vars) return fail(c, 404, 'NOT_FOUND', 'Application not found.');
  const finalSubject = render(subject, vars);
  const finalBody = render(text, vars);

  const result = await sendEmail(c.env, {
    to: vars.candidate_email,
    subject: finalSubject,
    text: finalBody,
    from: auth.org.email_from || c.env.EMAIL_FROM,
  });
  const id = await logCommunication(db, {
    orgId: auth.org.id,
    applicationId: d.application_id,
    templateId,
    channel: 'email',
    toEmail: vars.candidate_email,
    subject: finalSubject,
    body: finalBody,
    result,
    userId: auth.user.id,
  });
  await audit(db, auth, 'communication.sent', 'application', d.application_id, { communication_id: id, status: result.status, template: d.template_key || null }, clientIp(c));
  return c.json({
    success: true,
    communication_id: id,
    status: result.status,
    provider: result.provider,
    error: result.error || null,
    message: result.status === 'sent'
      ? 'The email provider accepted the message.'
      : result.status === 'failed'
        ? 'The provider rejected the message. It was not sent. Review the error and retry.'
        : 'No email provider is configured. The message is saved in the log and was not sent.',
  }, result.status === 'failed' ? 502 : 200);
});
