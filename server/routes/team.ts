import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { fail, requireAuth, requireRole, audit, clientIp } from '../auth';
import { canManageTeam } from '../permissions';
import { newId, randomToken, sha256Hex } from '../crypto';

export const teamRouter = new Hono<AppEnv>();
teamRouter.use('*', requireAuth());

teamRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const [members, invitations, jobs] = await Promise.all([
    db.all<any>(
      `SELECT m.id, m.user_id, m.role, m.title, m.status, m.created_at,
              u.full_name, u.email, u.is_active,
              (SELECT COUNT(*) FROM job_memberships jm WHERE jm.user_id = m.user_id AND jm.organization_id = m.organization_id) AS job_count,
              (SELECT COUNT(*) FROM interview_participants p JOIN interviews i ON i.id = p.interview_id WHERE p.user_id = m.user_id AND i.start_at > ?) AS upcoming_interviews
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'recruiter' THEN 2 WHEN 'hiring_manager' THEN 3 ELSE 4 END, u.full_name`,
      [Date.now(), auth.org.id],
    ),
    db.all<any>('SELECT id, email, role, title, expires_at, created_at FROM invitations WHERE organization_id = ? AND redeemed_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC', [auth.org.id]),
    db.all<any>(
      `SELECT jm.user_id, j.id AS job_id, j.title FROM job_memberships jm JOIN jobs j ON j.id = jm.job_id WHERE jm.organization_id = ?`,
      [auth.org.id],
    ),
  ]);
  return c.json({
    members: members.map((m) => ({ ...m, jobs: jobs.filter((j) => j.user_id === m.user_id) })),
    invitations,
    can_manage: canManageTeam(auth),
  });
});

const inviteSchema = z.object({
  email: z.string().email().max(160),
  role: z.enum(['admin', 'recruiter', 'hiring_manager', 'interviewer']),
  title: z.string().max(80).optional().nullable(),
});

teamRouter.post('/invite', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Enter a valid email and choose a role.');
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await db.get<any>(
    `SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? AND lower(u.email) = ?`,
    [auth.org.id, email],
  );
  if (existing) return fail(c, 409, 'ALREADY_MEMBER', 'That person is already in this workspace.');
  const pending = await db.get<any>(
    'SELECT id FROM invitations WHERE organization_id = ? AND lower(email) = ? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at > ?',
    [auth.org.id, email, Date.now()],
  );
  if (pending) return fail(c, 409, 'INVITE_PENDING', 'An invitation is already pending for that email.');

  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const now = Date.now();
  const id = newId('inv');
  const expiresAt = now + 7 * 86400_000;
  await db.run(
    'INSERT INTO invitations (id, organization_id, email, role, title, token_hash, expires_at, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, auth.org.id, email, parsed.data.role, parsed.data.title || null, hash, expiresAt, auth.user.id, now],
  );
  await audit(db, auth, 'team.invited', 'invitation', id, { email, role: parsed.data.role }, clientIp(c));
  const base = c.env.APP_URL || new URL(c.req.url).origin;
  return c.json({
    success: true,
    invite_url: `${base}/accept-invite?token=${token}`,
    expires_at: expiresAt,
    email_delivery: 'not_configured',
    note: 'No email provider is configured. Share this one-time link with your teammate directly.',
  }, 201);
});

teamRouter.post('/invite/:id/revoke', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const invite = await db.get<any>('SELECT * FROM invitations WHERE id = ? AND organization_id = ?', [c.req.param('id'), auth.org.id]);
  if (!invite) return fail(c, 404, 'NOT_FOUND', 'Invitation not found.');
  await db.run('UPDATE invitations SET revoked_at = ? WHERE id = ?', [Date.now(), invite.id]);
  await audit(db, auth, 'team.invite_revoked', 'invitation', invite.id, {}, clientIp(c));
  return c.json({ success: true });
});

const memberSchema = z.object({
  role: z.enum(['owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer']).optional(),
  title: z.string().max(80).nullable().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

teamRouter.patch('/members/:userId', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'Check the member details.');
  const userId = c.req.param('userId');
  const member = await db.get<any>('SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?', [auth.org.id, userId]);
  if (!member) return fail(c, 404, 'NOT_FOUND', 'Member not found.');

  const nextRole = parsed.data.role ?? member.role;
  const nextStatus = parsed.data.status ?? member.status;
  if (member.role === 'owner' && (nextRole !== 'owner' || nextStatus !== 'active')) {
    const owners = await db.get<any>("SELECT COUNT(*) AS n FROM memberships WHERE organization_id = ? AND role = 'owner' AND status = 'active'", [auth.org.id]);
    if (Number(owners?.n || 0) <= 1) return fail(c, 409, 'LAST_OWNER', 'Promote another owner before changing this account.');
  }
  if (userId === auth.user.id && nextStatus === 'disabled') {
    return fail(c, 409, 'SELF_DISABLE', 'You cannot disable your own account.');
  }
  await db.run('UPDATE memberships SET role = ?, title = ?, status = ?, updated_at = ? WHERE id = ?', [
    nextRole, parsed.data.title !== undefined ? parsed.data.title : member.title, nextStatus, Date.now(), member.id,
  ]);
  if (nextStatus === 'disabled') {
    await db.run('DELETE FROM sessions WHERE user_id = ? AND organization_id = ?', [userId, auth.org.id]);
  }
  await audit(db, auth, 'team.member_updated', 'membership', member.id, { role: nextRole, status: nextStatus }, clientIp(c));
  return c.json({ success: true });
});

teamRouter.delete('/members/:userId', requireRole('owner', 'admin'), async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const userId = c.req.param('userId');
  if (userId === auth.user.id) return fail(c, 409, 'SELF_REMOVE', 'You cannot remove yourself from the workspace.');
  const member = await db.get<any>('SELECT * FROM memberships WHERE organization_id = ? AND user_id = ?', [auth.org.id, userId]);
  if (!member) return fail(c, 404, 'NOT_FOUND', 'Member not found.');
  if (member.role === 'owner') {
    return fail(c, 409, 'OWNER_PROTECTED', 'Transfer ownership before removing an owner.');
  }
  await db.run("UPDATE memberships SET status = 'disabled', updated_at = ? WHERE id = ?", [Date.now(), member.id]);
  await db.run('DELETE FROM sessions WHERE user_id = ? AND organization_id = ?', [userId, auth.org.id]);
  await audit(db, auth, 'team.member_removed', 'membership', member.id, {}, clientIp(c));
  return c.json({ success: true });
});
