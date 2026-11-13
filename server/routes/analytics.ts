import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { fail, requireAuth } from '../auth';
import { isWorkspaceAdmin } from '../permissions';

export const analyticsRouter = new Hono<AppEnv>();
analyticsRouter.use('*', requireAuth());

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

analyticsRouter.get('/', async (c) => {
  const auth = c.get('auth')!;
  if (auth.membership.role === 'interviewer') {
    return fail(c, 403, 'FORBIDDEN', 'Pipeline analytics are available to the hiring team.');
  }
  const db = c.get('db');
  const from = Number(c.req.query('from') || Date.now() - 90 * 86400_000);
  const to = Number(c.req.query('to') || Date.now());
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return fail(c, 400, 'INVALID_RANGE', 'Choose a valid date range.');
  }

  const scopeParams: unknown[] = [];
  let jobFilter = '';
  if (!isWorkspaceAdmin(auth)) {
    jobFilter = ' AND (j.hiring_owner_id = ? OR j.id IN (SELECT job_id FROM job_memberships WHERE user_id = ?))';
    scopeParams.push(auth.user.id, auth.user.id);
  }

  const applications = await db.all<any>(
    `SELECT a.id, a.job_id, a.stage_id, a.status, a.source, a.applied_at, a.stage_entered_at, a.first_reviewed_at,
            a.owner_user_id, a.anonymized_at, j.title AS job_title, j.published_at,
            s.name AS stage_name, s.position AS stage_position, s.kind AS stage_kind,
            u.full_name AS owner_name
       FROM applications a JOIN jobs j ON j.id = a.job_id JOIN pipeline_stages s ON s.id = a.stage_id
       LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE a.organization_id = ? AND a.applied_at BETWEEN ? AND ?${jobFilter}`,
    [auth.org.id, from, to, ...scopeParams],
  );

  const appIds = applications.map((a) => a.id);
  let events: any[] = [];
  if (appIds.length) {
    const placeholders = appIds.map(() => '?').join(',');
    events = await db.all<any>(
      `SELECT e.application_id, e.created_at, e.to_stage_id, s.name AS to_stage_name, s.position AS to_position, s.kind AS to_kind
         FROM stage_events e JOIN pipeline_stages s ON s.id = e.to_stage_id
        WHERE e.application_id IN (${placeholders}) ORDER BY e.application_id, e.created_at`,
      appIds,
    );
  }

  const interviews = await db.all<any>(
    `SELECT i.id, i.start_at, i.status, i.application_id,
            (SELECT COUNT(*) FROM scorecards s WHERE s.interview_id = i.id) AS scorecards,
            (SELECT overall FROM scorecards s WHERE s.interview_id = i.id ORDER BY s.submitted_at DESC LIMIT 1) AS latest_overall
       FROM interviews i JOIN applications a ON a.id = i.application_id JOIN jobs j ON j.id = i.job_id
      WHERE i.organization_id = ? AND i.start_at BETWEEN ? AND ?${jobFilter}`,
    [auth.org.id, from, to, ...scopeParams],
  );

  const stageRows = await db.all<any>(
    `SELECT s.id, s.name, s.position, s.kind,
            (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id
              WHERE a.stage_id = s.id AND a.status = 'active' AND a.organization_id = ?${jobFilter}) AS active_count
       FROM pipeline_stages s WHERE s.organization_id = ? ORDER BY s.position`,
    [auth.org.id, ...scopeParams, auth.org.id],
  );

  const total = applications.length;
  const bySource = new Map<string, number>();
  for (const a of applications) bySource.set(a.source || 'unknown', (bySource.get(a.source || 'unknown') || 0) + 1);

  // Funnel: an application counts at the furthest stage position it reached.
  const furthest = new Map<string, number>();
  for (const e of events) {
    const prev = furthest.get(e.application_id) || 0;
    if (e.to_position > prev) furthest.set(e.application_id, e.to_position);
  }
  const maxPosition = Math.max(0, ...stageRows.map((s) => Number(s.position)));
  const reached = (minPosition: number) => applications.filter((a) => (furthest.get(a.id) || 0) >= minPosition).length;
  const funnelStages = stageRows.filter((s) => s.kind === 'active' || s.kind === 'offer');
  const funnel = funnelStages.map((s) => ({
    stage: s.name,
    position: s.position,
    count: reached(Number(s.position)),
    share: total ? Math.round((reached(Number(s.position)) / total) * 1000) / 10 : 0,
  }));

  // Time in stage, averaged across completed stage spells.
  const spells = new Map<string, number[]>();
  const byApp = new Map<string, any[]>();
  for (const e of events) {
    if (!byApp.has(e.application_id)) byApp.set(e.application_id, []);
    byApp.get(e.application_id)!.push(e);
  }
  for (const [, list] of byApp) {
    for (let i = 0; i < list.length - 1; i++) {
      const days = (list[i + 1].created_at - list[i].created_at) / 86400_000;
      if (days < 0 || days > 365) continue;
      if (!spells.has(list[i].to_stage_name)) spells.set(list[i].to_stage_name, []);
      spells.get(list[i].to_stage_name)!.push(days);
    }
  }
  const timeInStage = [...spells.entries()].map(([stage, values]) => ({
    stage,
    average_days: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10,
    samples: values.length,
  })).sort((a, b) => b.average_days - a.average_days);

  const reviewed = applications.filter((a) => a.first_reviewed_at);
  const timeToFirstReview = reviewed.length
    ? Math.round((reviewed.reduce((s, a) => s + (a.first_reviewed_at - a.applied_at), 0) / reviewed.length / 3600_000) * 10) / 10
    : null;

  const hiredApps = applications.filter((a) => a.status === 'hired');
  const hiredEvents = events.filter((e) => e.to_kind === 'hired');
  const fillTimes: number[] = [];
  for (const e of hiredEvents) {
    const app = applications.find((a) => a.id === e.application_id);
    if (app?.published_at && e.created_at > app.published_at) fillTimes.push((e.created_at - app.published_at) / 86400_000);
  }
  const timeToFill = fillTimes.length ? Math.round((fillTimes.reduce((s, v) => s + v, 0) / fillTimes.length) * 10) / 10 : null;

  const outcomeCounts: Record<string, number> = { strong_yes: 0, yes: 0, no: 0, strong_no: 0 };
  for (const i of interviews) {
    if (i.latest_overall && outcomeCounts[i.latest_overall] !== undefined) outcomeCounts[i.latest_overall]++;
  }

  const workload = new Map<string, { owner: string; applications: number; active: number }>();
  for (const a of applications) {
    const key = a.owner_user_id || 'unassigned';
    const name = a.owner_name || 'Unassigned';
    if (!workload.has(key)) workload.set(key, { owner: name, applications: 0, active: 0 });
    const entry = workload.get(key)!;
    entry.applications++;
    if (a.status === 'active') entry.active++;
  }

  // Daily trend with zero-filled days so the chart shows real quiet periods.
  const trend: { date: string; applications: number }[] = [];
  const days = Math.min(180, Math.max(1, Math.ceil((to - from) / 86400_000) + 1));
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(to - i * 86400_000);
    trend.push({ date: d, applications: applications.filter((a) => dayKey(a.applied_at) === d).length });
  }

  return c.json({
    range: { from, to, days },
    totals: {
      applications: total,
      active: applications.filter((a) => a.status === 'active').length,
      hired: hiredApps.length,
      rejected: applications.filter((a) => a.status === 'rejected').length,
      withdrawn: applications.filter((a) => a.status === 'withdrawn').length,
      interviews: interviews.length,
      scheduled_interviews: interviews.filter((i) => i.status === 'scheduled').length,
      scorecards: interviews.reduce((s, i) => s + Number(i.scorecards || 0), 0),
    },
    by_source: [...bySource.entries()].map(([source, count]) => ({ source, count, share: total ? Math.round((count / total) * 1000) / 10 : 0 })).sort((a, b) => b.count - a.count),
    stage_breakdown: stageRows.map((s) => ({ stage: s.name, kind: s.kind, count: Number(s.active_count || 0) })),
    funnel,
    funnel_denominator: total,
    time_in_stage: timeInStage,
    time_to_first_review_hours: timeToFirstReview,
    first_review_samples: reviewed.length,
    time_to_fill_days: timeToFill,
    time_to_fill_samples: fillTimes.length,
    interview_outcomes: outcomeCounts,
    workload: [...workload.values()].sort((a, b) => b.applications - a.applications),
    trend,
    notes: [
      'Every figure is computed from records in the selected date range and workspace.',
      'Conversion shows the share of applications that reached each stage at least once.',
      'No demographic or protected-trait analysis is performed.',
    ],
  });
});
