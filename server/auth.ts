import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './app-env';
import type { AuthContext, Role } from './types';
import { newId, randomToken, sha256Hex } from './crypto';
import { prevHashFor, chainHash } from './hashchain';
import type { Db } from './db';

export const SESSION_COOKIE = 'hf_session';
const SESSION_DAYS = 30;

export function fail(c: any, status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500, code: string, message: string) {
  return c.json({ error: message, code }, status);
}

export async function createSession(db: Db, userId: string, orgId: string) {
  const token = randomToken(32);
  const expiresAt = Date.now() + SESSION_DAYS * 86400_000;
  const tokenHash = await sha256Hex(token);
  await db.run(
    'INSERT INTO sessions (id, user_id, organization_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [newId('sess'), userId, orgId, tokenHash, expiresAt, Date.now()],
  );
  return { token, expiresAt };
}

export function writeSessionCookie(c: any, token: string, expiresAt: number) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(c: any) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function attachAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('auth', null);
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return next();

    const db = c.get('db');
    const tokenHash = await sha256Hex(token);
    const row = await db.get<any>(
      `SELECT s.id AS session_id, s.expires_at,
              u.id AS user_id, u.email, u.full_name, u.is_active AS user_active,
              m.id AS membership_id, m.role, m.title AS member_title, m.status AS membership_status,
              o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.website, o.careers_intro,
              o.timezone, o.privacy_notice_version, o.privacy_notice_url, o.default_retention_days,
              o.ai_enabled, o.ai_provider, o.email_provider, o.email_from
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN memberships m ON m.organization_id = s.organization_id AND m.user_id = s.user_id
         JOIN organizations o ON o.id = s.organization_id
        WHERE s.token_hash = ?`,
      [tokenHash],
    );

    if (!row || row.user_active !== 1 || row.membership_status !== 'active') return next();
    if (row.expires_at < Date.now()) return next();

    const auth: AuthContext = {
      user: { id: row.user_id, email: row.email, full_name: row.full_name, is_active: row.user_active },
      org: {
        id: row.org_id, name: row.org_name, slug: row.org_slug, website: row.website,
        careers_intro: row.careers_intro, timezone: row.timezone || 'Asia/Kolkata',
        privacy_notice_version: row.privacy_notice_version,
        privacy_notice_url: row.privacy_notice_url,
        default_retention_days: row.default_retention_days || 365,
        ai_enabled: row.ai_enabled || 0, ai_provider: row.ai_provider,
        email_provider: row.email_provider, email_from: row.email_from,
      },
      membership: { id: row.membership_id, role: row.role as Role, title: row.member_title, status: row.membership_status },
      session: { id: row.session_id, csrf: tokenHash.slice(0, 24) },
    };

    c.set('auth', auth);
    return next();
  };
}

export function csrfGuard(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) return next();
    const path = c.req.path;
    if (path.startsWith('/api/v1/auth/') || path.startsWith('/api/v1/public/') || path.startsWith('/api/v1/portal/')) {
      return next();
    }
    const auth = c.get('auth');
    if (!auth) return next();
    const origin = c.req.header('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== new URL(c.req.url).host) {
          return fail(c, 403, 'ORIGIN_REJECTED', 'Cross-origin writes are not permitted.');
        }
      } catch {
        return fail(c, 403, 'ORIGIN_REJECTED', 'Invalid origin header.');
      }
    }
    const supplied = c.req.header('x-csrf-token') || '';
    if (!supplied || supplied !== auth.session.csrf) {
      return fail(c, 403, 'CSRF_FAILED', 'Invalid session security token. Please refresh the page.');
    }
    return next();
  };
}

export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('auth')) return fail(c, 401, 'UNAUTHENTICATED', 'Sign in to access this workspace.');
    return next();
  };
}

export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) return fail(c, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
    if (!roles.includes(auth.membership.role)) {
      return fail(c, 403, 'FORBIDDEN', `Role '${auth.membership.role}' is not authorized for this action.`);
    }
    return next();
  };
}

export async function audit(
  db: Db,
  auth: AuthContext | null,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  metadata: Record<string, unknown> = {},
  ipAddress = '127.0.0.1',
) {
  if (!auth) return;
  const now = Date.now();
  const prev = await prevHashFor(db, auth.org.id);
  const payload = JSON.stringify({ action, resourceType, resourceId: resourceId || null, metadata, ip: ipAddress, at: now });
  const rowHash = await chainHash(prev, payload);
  await db.run(
    `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata_json, ip_address, created_at, prev_hash, row_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId('aud'), auth.org.id, auth.user.id, action, resourceType, resourceId || null, JSON.stringify(metadata), ipAddress, now, prev, rowHash],
  );
}

export function clientIp(c: any): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
}

/** Audit an action performed by a candidate or the system, with no staff user. */
export async function auditSystem(
  db: Db,
  orgId: string,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  metadata: Record<string, unknown> = {},
  ipAddress = '127.0.0.1',
) {
  const now = Date.now();
  const prev = await prevHashFor(db, orgId);
  const payload = JSON.stringify({ action, resourceType, resourceId: resourceId || null, metadata, ip: ipAddress, at: now });
  const rowHash = await chainHash(prev, payload);
  await db.run(
    `INSERT INTO audit_events (id, organization_id, user_id, action, resource_type, resource_id, metadata_json, ip_address, created_at, prev_hash, row_hash)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId('aud'), orgId, action, resourceType, resourceId || null, JSON.stringify(metadata), ipAddress, now, prev, rowHash],
  );
}
