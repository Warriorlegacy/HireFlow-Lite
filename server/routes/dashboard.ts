import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireAuth } from '../auth';
import { isWorkspaceAdmin } from '../permissions';

export const dashboardRouter = new Hono<AppEnv>();
dashboardRouter.use('*', requireAuth());

dashboardRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');
  const now = Date.now();

  // Job scope for staff queries. Interviewers only see their assigned packets.
  let jobScope = '';
  let scopeParams: unknown[] = [];
  if (!isWorkspaceAdmin(auth)) {
    if (auth.membership.role === 'interviewer') {
      jobScope = ' AND j.id IN (SELECT i.job_id FROM interviews i JOIN interview_participants p ON p.interview_id = i.id WHERE p.user_id = ?)';
      scopeParams = [auth.user.id];
    } else {
      jobScope = ' AND (j.hiring_owner_id = ? OR j.id IN (SELECT job_id FROM job_memberships WHERE user_id = ?))';
      scopeParams = [auth.user.id, auth.user.id];
    }
  }
  const interviewScope = auth.membership.role === 'interviewer'
    ? ' AND i.id IN (SELECT interview_id FROM interview_participants WHERE user_id = ?)'
    : jobScope.replace(/j\./g, 'j.');

  const appScope = `a.organization_id = ? AND j.organization_id = a.organization_id${jobScope}`;

  const [activeApplications, newApplications, publishedJobs, upcomingCount, recentHires, openDataRequests] = await Promise.all([
    db.get<any>(`SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE ${appScope} AND a.status = 'active'`, [auth.org.id, ...scopeParams]),
    db.get<any>(`SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE ${appScope} AND a.status = 'active' AND a.stage_id = 'stg_new'`, [auth.org.id, ...scopeParams]),
    db.get<any>(`SELECT COUNT(*) AS n FROM jobs j WHERE j.organization_id = ? AND j.status = 'published'${jobScope}`, [auth.org.id, ...scopeParams]),
    db.get<any>(`SELECT COUNT(*) AS n FROM interviews i JOIN jobs j ON j.id = i.job_id WHERE i.organization_id = ? AND i.status = 'scheduled' AND i.start_at >= ?${interviewScope}`, [auth.org.id, now, ...scopeParams]),
    db.get<any>(`SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE ${appScope} AND a.status = 'hired' AND a.applied_at >= ?`, [auth.org.id, now - 90 * 86400_000, ...scopeParams]),
    db.get<any>(`SELECT COUNT(*) AS n FROM deletion_requests d JOIN applications a ON a.id = d.application_id JOIN jobs j ON j.id = a.job_id WHERE d.organization_id = ? AND d.status = 'open'${jobScope}`, [auth.org.id, ...scopeParams]),
  ]);

  const [upcoming, attention, recent, pipeline, deletionRequests] = await Promise.all([
    db.all<any>(
      `SELECT i.*, c.full_name AS candidate_name, j.title AS job_title,
              (SELECT COUNT(*) FROM scorecards s WHERE s.interview_id = i.id) AS scorecard_count
         FROM interviews i JOIN applications a ON a.id = i.application_id
         JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = i.job_id
        WHERE i.organization_id = ? AND i.status = 'scheduled' AND i.start_at >= ?${interviewScope}
        ORDER BY i.start_at ASC LIMIT 6`,
      [auth.org.id, now, ...scopeParams],
    ),
    db.all<any>(
      `SELECT a.id, a.stage_entered_at, a.applied_at, c.full_name AS candidate_name, j.title AS job_title,
              s.name AS stage_name, s.kind AS stage_kind, u.full_name AS owner_name
         FROM applications a JOIN candidates c ON c.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id JOIN pipeline_stages s ON s.id = a.stage_id
         LEFT JOIN users u ON u.id = a.owner_user_id
        WHERE ${appScope} AND a.status = 'active' AND s.kind = 'active'
        ORDER BY a.stage_entered_at ASC LIMIT 8`,
      [auth.org.id, ...scopeParams],
    ),
    db.all<any>(
      `SELECT e.created_at, e.reason, ts.name AS to_stage_name, u.full_name AS actor_name,
              c.full_name AS candidate_name, j.title AS job_title, a.id AS application_id
         FROM stage_events e JOIN applications a ON a.id = e.application_id
         JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
         JOIN pipeline_stages ts ON ts.id = e.to_stage_id
         LEFT JOIN users u ON u.id = e.actor_user_id
        WHERE e.organization_id = ?${jobScope}
        ORDER BY e.created_at DESC LIMIT 10`,
      [auth.org.id, ...scopeParams],
    ),
    db.all<any>(
      `SELECT s.id, s.name, s.position, s.kind,
              (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id
                WHERE a.stage_id = s.id AND a.status = 'active' AND a.organization_id = ?${jobScope}) AS count
         FROM pipeline_stages s WHERE s.organization_id = ? ORDER BY s.position`,
      [auth.org.id, ...scopeParams, auth.org.id],
    ),
    auth.membership.role === 'owner' || auth.membership.role === 'admin'
      ? db.all<any>(
          `SELECT d.id, d.request_type, d.status, d.created_at, c.full_name AS candidate_name, j.title AS job_title
             FROM deletion_requests d JOIN applications a ON a.id = d.application_id
             JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
            WHERE d.organization_id = ? ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.created_at DESC LIMIT 5`,
          [auth.org.id],
        )
      : Promise.resolve([]),
  ]);

  return c.json({
    counts: {
      active_applications: Number(activeApplications?.n || 0),
      new_applications: Number(newApplications?.n || 0),
      published_jobs: Number(publishedJobs?.n || 0),
      upcoming_interviews: Number(upcomingCount?.n || 0),
      hires_recent: Number(recentHires?.n || 0),
      open_data_requests: Number(openDataRequests?.n || 0),
    },
    upcoming_interviews: upcoming,
    attention: attention.map((a) => ({ ...a, days_in_stage: Math.max(0, Math.floor((now - a.stage_entered_at) / 86400_000)) })),
    recent_activity: recent,
    pipeline,
    data_requests: deletionRequests,
    role: auth.membership.role,
  });
});
