import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { fail, requireAuth } from '../auth';
import { isWorkspaceAdmin } from '../permissions';

export const auditRouter = new Hono<AppEnv>();
auditRouter.use('*', requireAuth());

auditRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  if (!isWorkspaceAdmin(auth)) return fail(c, 403, 'FORBIDDEN', 'Only owners and admins can read the audit log.');
  const db = c.get('db');
  const page = Math.max(1, Number(c.req.query('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 40)));
  const action = c.req.query('action');
  const params: unknown[] = [auth.org.id];
  const conditions = ['organization_id = ?'];
  if (action) {
    // Escape LIKE wildcards so underscores in action names (e.g. stage_changed) match literally.
    const escaped = action.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    conditions.push("action LIKE ? ESCAPE '\\'");
    params.push(`${escaped}%`);
  }
  const where = conditions.join(' AND ');
  const total = await db.get<any>(`SELECT COUNT(*) AS n FROM audit_events WHERE ${where}`, params);
  const events = await db.all<any>(
    `SELECT e.*, e.row_hash AS hash, u.full_name AS user_name FROM audit_events e LEFT JOIN users u ON u.id = e.user_id
      WHERE ${where.replace('organization_id = ?', 'e.organization_id = ?').replace('action LIKE ?', 'e.action LIKE ?')}
      ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );
  const actions = await db.all<any>('SELECT DISTINCT action FROM audit_events WHERE organization_id = ? ORDER BY action', [auth.org.id]);
  return c.json({
    events: events.map((e) => ({ ...e, metadata: (() => { try { return JSON.parse(e.metadata_json); } catch { return {}; } })() })),
    actions: actions.map((a) => a.action),
    pagination: { page, limit, total: Number(total?.n || 0), pages: Math.max(1, Math.ceil(Number(total?.n || 0) / limit)) },
  });
});
