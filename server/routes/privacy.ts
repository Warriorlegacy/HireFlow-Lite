import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, requireRole, audit, clientIp } from '../auth';
import { anonymizeApplication } from '../retention';

export const privacyRouter = new Hono<AppEnv>();
privacyRouter.use('*', requireAuth());

privacyRouter.get('/requests', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const rows = await db.all<any>(
    `SELECT d.*, c.full_name AS candidate_name, c.email AS candidate_email, j.title AS job_title, a.status AS application_status,
            a.anonymized_at
       FROM deletion_requests d JOIN applications a ON a.id = d.application_id
       JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
      WHERE d.organization_id = ? ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.created_at DESC LIMIT 200`,
    [auth.org.id],
  );
  return c.json({ requests: rows });
});

const resolveSchema = z.object({
  action: z.enum(['anonymise', 'reject']),
  note: z.string().max(1000).optional().nullable(),
});

privacyRouter.post('/requests/:id/resolve', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Choose whether to anonymise the record or reject the request.');
  const request = await db.get<any>('SELECT * FROM deletion_requests WHERE id = ? AND organization_id = ?', [c.req.param('id'), auth.org.id]);
  if (!request) return fail(c, 404, 'NOT_FOUND', 'Request not found.');
  if (request.status === 'completed') return fail(c, 409, 'ALREADY_RESOLVED', 'This request is already complete.');

  const now = Date.now();
  if (parsed.data.action === 'anonymise') {
    const done = await anonymizeApplication(c.env, db, auth.org.id, request.application_id);
    await db.run(
      "UPDATE deletion_requests SET status = 'completed', resolved_at = ?, resolved_by_user_id = ?, resolution_note = ? WHERE id = ?",
      [now, auth.user.id, parsed.data.note || (done ? 'Application anonymised.' : 'Record was already anonymised.'), request.id],
    );
    await audit(db, auth, 'privacy.request_completed', 'deletion_request', request.id, { type: request.request_type }, clientIp(c));
    return c.json({ success: true, status: 'completed', anonymised: done });
  }

  await db.run(
    "UPDATE deletion_requests SET status = 'rejected', resolved_at = ?, resolved_by_user_id = ?, resolution_note = ? WHERE id = ?",
    [now, auth.user.id, parsed.data.note || 'Request reviewed and declined under the retention policy.', request.id],
  );
  await audit(db, auth, 'privacy.request_rejected', 'deletion_request', request.id, { type: request.request_type }, clientIp(c));
  return c.json({ success: true, status: 'rejected' });
});
