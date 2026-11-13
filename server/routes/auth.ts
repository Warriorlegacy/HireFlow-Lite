import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { verifyPassword, sha256Hex, hashPassword, newId } from '../crypto';
import {
  createSession,
  writeSessionCookie,
  clearSessionCookie,
  fail,
  audit,
  clientIp,
} from '../auth';
import { rateLimit } from '../ratelimit';

export const authRouter = new Hono<AppEnv>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(c, 400, 'INVALID_INPUT', 'Enter a valid email and password.');
  }

  const db = c.get('db');
  const ip = clientIp(c);
  const limit = await rateLimit(db, `login:${ip}`, 20, 15 * 60_000);
  if (!limit.allowed) return fail(c, 429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again in a few minutes.');

  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.get<any>(
    'SELECT id, email, password_hash, full_name, is_active FROM users WHERE email = ?',
    [email],
  );

  if (!user || user.is_active !== 1) {
    return fail(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) return fail(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');

  const membership = await db.get<any>(
    `SELECT m.organization_id, m.role, o.name AS org_name
       FROM memberships m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ? AND m.status = 'active'
      LIMIT 1`,
    [user.id],
  );
  if (!membership) return fail(c, 403, 'NO_ORGANIZATION', 'This account has no active workspace.');

  const { token, expiresAt } = await createSession(db, user.id, membership.organization_id);
  writeSessionCookie(c, token, expiresAt);
  const tokenHash = await sha256Hex(token);

  return c.json({
    success: true,
    user: { id: user.id, email: user.email, full_name: user.full_name },
    role: membership.role,
    organization: { id: membership.organization_id, name: membership.org_name },
    csrf_token: tokenHash.slice(0, 24),
  });
});

authRouter.post('/logout', async (c) => {
  const auth = c.get('auth');
  if (auth) {
    const db = c.get('db');
    await db.run('DELETE FROM sessions WHERE id = ?', [auth.session.id]);
    await audit(db, auth, 'user.logout', 'user', auth.user.id, {}, clientIp(c));
  }
  clearSessionCookie(c);
  return c.json({ success: true });
});

authRouter.get('/me', (c) => {
  const auth = c.get('auth');
  if (!auth) return c.json({ authenticated: false, user: null, org: null });
  return c.json({
    authenticated: true,
    user: auth.user,
    org: auth.org,
    membership: auth.membership,
    csrf_token: auth.session.csrf,
  });
});

// Demo persona switcher, active only while ALLOW_DEMO is not false.
authRouter.post('/demo-switch', async (c) => {
  if (c.env.ALLOW_DEMO === 'false') {
    return fail(c, 403, 'DEMO_DISABLED', 'Demo switching is disabled in this environment.');
  }
  const body = await c.req.json().catch(() => ({}));
  const targetEmail = String(body.email || 'owner@hireflow.demo').toLowerCase().trim();
  const db = c.get('db');
  const user = await db.get<any>('SELECT id, email, full_name, is_active FROM users WHERE email = ?', [targetEmail]);
  if (!user || user.is_active !== 1) return fail(c, 404, 'USER_NOT_FOUND', 'Demo account not found.');

  const membership = await db.get<any>(
    `SELECT m.organization_id, m.role, o.name AS org_name
       FROM memberships m JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ? AND m.status = 'active' LIMIT 1`,
    [user.id],
  );
  if (!membership) return fail(c, 403, 'NO_MEMBERSHIP', 'No active membership for this demo user.');

  const { token, expiresAt } = await createSession(db, user.id, membership.organization_id);
  writeSessionCookie(c, token, expiresAt);
  const tokenHash = await sha256Hex(token);
  return c.json({
    success: true,
    user: { id: user.id, email: user.email, full_name: user.full_name },
    role: membership.role,
    organization: { id: membership.organization_id, name: membership.org_name },
    csrf_token: tokenHash.slice(0, 24),
  });
});

const acceptSchema = z.object({
  token: z.string().min(10),
  full_name: z.string().min(2).max(120),
  password: z.string().min(10).max(200),
});

authRouter.post('/accept-invite', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return fail(c, 400, 'INVALID_INPUT', 'Enter your name and a password of at least 10 characters.');
  }
  const db = c.get('db');
  const tokenHash = await sha256Hex(parsed.data.token.trim());
  const invite = await db.get<any>('SELECT * FROM invitations WHERE token_hash = ?', [tokenHash]);
  if (!invite) return fail(c, 404, 'NOT_FOUND', 'This invitation link is not valid.');
  if (invite.revoked_at) return fail(c, 410, 'REVOKED', 'This invitation has been revoked.');
  if (invite.redeemed_at) return fail(c, 410, 'REDEEMED', 'This invitation has already been used.');
  if (invite.expires_at < Date.now()) return fail(c, 410, 'EXPIRED', 'This invitation has expired.');

  const email = String(invite.email).toLowerCase().trim();
  let user = await db.get<any>('SELECT * FROM users WHERE email = ?', [email]);
  const now = Date.now();
  if (user) {
    await db.run('UPDATE users SET password_hash = ?, full_name = ?, updated_at = ? WHERE id = ?', [
      await hashPassword(parsed.data.password),
      parsed.data.full_name.trim(),
      now,
      user.id,
    ]);
  } else {
    const userId = newId('usr');
    await db.run(
      'INSERT INTO users (id, email, password_hash, full_name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [userId, email, await hashPassword(parsed.data.password), parsed.data.full_name.trim(), now, now],
    );
    user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  }

  const existing = await db.get<any>('SELECT id FROM memberships WHERE organization_id = ? AND user_id = ?', [
    invite.organization_id,
    user.id,
  ]);
  if (existing) {
    await db.run('UPDATE memberships SET role = ?, title = ?, status = ?, updated_at = ? WHERE id = ?', [
      invite.role,
      invite.title,
      'active',
      now,
      existing.id,
    ]);
  } else {
    await db.run(
      'INSERT INTO memberships (id, organization_id, user_id, role, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [newId('mem'), invite.organization_id, user.id, invite.role, invite.title, 'active', now, now],
    );
  }

  await db.run('UPDATE invitations SET redeemed_at = ?, redeemed_user_id = ? WHERE id = ?', [now, user.id, invite.id]);
  const { token, expiresAt } = await createSession(db, user.id, invite.organization_id);
  writeSessionCookie(c, token, expiresAt);
  return c.json({ success: true, role: invite.role });
});

authRouter.post('/change-password', async (c) => {
  const auth = c.get('auth');
  if (!auth) return fail(c, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ current_password: z.string().min(1), new_password: z.string().min(10).max(200) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(c, 400, 'INVALID_INPUT', 'New password must be at least 10 characters.');

  const db = c.get('db');
  const user = await db.get<any>('SELECT password_hash FROM users WHERE id = ?', [auth.user.id]);
  if (!user || !(await verifyPassword(parsed.data.current_password, user.password_hash))) {
    return fail(c, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }
  await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    await hashPassword(parsed.data.new_password),
    Date.now(),
    auth.user.id,
  ]);
  await db.run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [auth.user.id, auth.session.id]);
  await audit(db, auth, 'user.password_changed', 'user', auth.user.id, {}, clientIp(c));
  return c.json({ success: true });
});
