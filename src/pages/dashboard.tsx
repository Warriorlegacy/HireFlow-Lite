import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileWarning,
  Plus,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Avatar } from '../components/ui';
import { daysIn, formatDateTime, formatTime, STATUS_LABELS, timeAgo } from '../lib/format';
import type { Interview, Stage } from '../types';

interface DashboardData {
  counts: {
    active_applications: number;
    new_applications: number;
    published_jobs: number;
    upcoming_interviews: number;
    hires_recent: number;
    open_data_requests: number;
  };
  upcoming_interviews: (Interview & { candidate_name: string; job_title: string; scorecard_count: number })[];
  attention: {
    id: string;
    candidate_name: string;
    job_title: string;
    stage_name: string;
    stage_entered_at: number;
    days_in_stage: number;
    owner_name: string | null;
  }[];
  recent_activity: {
    created_at: number;
    reason: string | null;
    to_stage_name: string;
    actor_name: string | null;
    candidate_name: string;
    job_title: string;
    application_id: string;
  }[];
  pipeline: (Stage & { count: number })[];
  data_requests: {
    id: string;
    request_type: string;
    status: string;
    created_at: number;
    candidate_name: string;
    job_title: string;
  }[];
  role: string;
}

export function DashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const role = session?.membership?.role;
  const isInterviewer = role === 'interviewer';
  const isAdmin = role === 'owner' || role === 'admin';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<DashboardData>('/dashboard'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingBlock rows={6} />
      </>
    );
  }
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return null;

  const maxStage = Math.max(1, ...data.pipeline.map((s) => Number(s.count) || 0));
  const firstName = session?.user?.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={isInterviewer ? `Good to see you, ${firstName}` : `Hiring desk`}
        description={
          isInterviewer
            ? 'Your assigned interview packets. You can read the candidate brief and submit a scorecard after the conversation.'
            : `What needs attention across ${session?.org?.name}. Everything below comes from live records in this workspace.`
        }
        actions={
          <>
            {!isInterviewer && (
              <Link to="/jobs/new">
                <Button icon={<Plus size={15} />}>New role</Button>
              </Link>
            )}
            <Link to="/interviews">
              <Button variant="primary" icon={<CalendarClock size={15} />}>Interviews</Button>
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        {[
          { label: isInterviewer ? 'Assigned interviews' : 'Active applications', value: isInterviewer ? data.counts.upcoming_interviews : data.counts.active_applications, note: isInterviewer ? 'scheduled ahead' : `${data.counts.new_applications} not yet reviewed` },
          { label: 'Upcoming interviews', value: data.counts.upcoming_interviews, note: 'scheduled from now' },
          { label: isInterviewer ? 'Roles in workspace' : 'Published roles', value: data.counts.published_jobs, note: 'accepting applications' },
          { label: 'Hires, last 90 days', value: data.counts.hires_recent, note: 'marked hired' },
        ].map((stat) => (
          <div key={stat.label} className="card px-4 py-4 sm:px-5">
            <p className="text-[12px] leading-tight text-muted">{stat.label}</p>
            <p className="mt-2 font-display text-[30px] leading-none text-ink">{stat.value ?? 0}</p>
            <p className="mt-1.5 text-[11.5px] text-muted">{stat.note}</p>
          </div>
        ))}
      </section>

      {isAdmin && data.counts.open_data_requests > 0 && (
        <Link to="/privacy-requests" className="mt-4 flex items-center gap-3 rounded-card border border-warning/25 bg-warningSoft/70 px-4 py-3 hover:border-warning/50">
          <FileWarning size={17} className="text-warning" />
          <p className="flex-1 text-[13px] text-warning">
            {data.counts.open_data_requests} candidate data {data.counts.open_data_requests === 1 ? 'request needs' : 'requests need'} a decision.
          </p>
          <ArrowRight size={15} className="text-warning" />
        </Link>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <h2 className="text-[14px] font-medium text-ink">Upcoming interviews</h2>
            <Link to="/interviews" className="text-[12.5px] text-accent underline underline-offset-2">All interviews</Link>
          </div>
          {data.upcoming_interviews.length === 0 ? (
            <EmptyState title="No interviews scheduled" icon={<CalendarClock size={18} />}>
              Once you schedule a conversation, it appears here with the assigned interviewers.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-rule/80">
              {data.upcoming_interviews.map((interview) => (
                <li key={interview.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="w-[68px] shrink-0 rounded-md border border-rule bg-[#f4f0e6] px-1.5 py-1 text-center">
                    <p className="text-[10.5px] text-muted">{new Date(interview.start_at).toLocaleDateString('en-IN', { month: 'short' })}</p>
                    <p className="text-[17px] font-medium leading-tight text-ink">{new Date(interview.start_at).getDate()}</p>
                    <p className="font-mono text-[10px] text-graphite">{formatTime(interview.start_at, interview.timezone)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/interviews/${interview.id}`} className="text-[13.5px] font-medium text-ink hover:underline">
                      {interview.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[12.5px] text-graphite">
                      {interview.candidate_name} · {interview.job_title}
                    </p>
                    <p className="mt-1 text-[11.5px] text-muted">
                      {interview.format} · {interview.scorecard_count} scorecard{interview.scorecard_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Link to={`/interviews/${interview.id}`} className="mt-1 text-muted hover:text-accent" aria-label={`Open ${interview.title}`}>
                    <ArrowRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="border-b border-rule px-5 py-3.5">
            <h2 className="text-[14px] font-medium text-ink">Pipeline</h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            {data.pipeline.map((stage) => (
              <div key={stage.id}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="text-graphite">{stage.name}</span>
                  <span className="font-mono text-[11.5px] text-muted">{stage.count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-accent/80" style={{ width: `${(Number(stage.count) / maxStage) * 100}%` }} />
                </div>
              </div>
            ))}
            {data.pipeline.length === 0 && <p className="text-[13px] text-muted">No stages configured.</p>}
          </div>
          {!isInterviewer && (
            <div className="border-t border-rule px-5 py-3">
              <Link to="/jobs" className="text-[12.5px] text-accent underline underline-offset-2">Open the pipeline by role</Link>
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {!isInterviewer && (
          <section className="card">
            <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
              <h2 className="text-[14px] font-medium text-ink">Sitting longest</h2>
              <span className="text-[11.5px] text-muted">needs a next step</span>
            </div>
            {data.attention.length === 0 ? (
              <EmptyState title="Nothing is stale" icon={<CheckCircle2 size={18} />}>
                Every active application has moved recently.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-rule/80">
                {data.attention.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={item.candidate_name} size={26} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/applications/${item.id}`} className="block truncate text-[13px] font-medium text-ink hover:underline">
                        {item.candidate_name}
                      </Link>
                      <p className="truncate text-[11.5px] text-muted">{item.job_title} · {item.stage_name}</p>
                    </div>
                    <span className={`flex items-center gap-1 whitespace-nowrap font-mono text-[11px] ${item.days_in_stage >= 7 ? 'text-warning' : 'text-muted'}`}>
                      <Clock size={11} /> {item.days_in_stage}d
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className={`card ${isInterviewer ? 'lg:col-span-2' : ''}`}>
          <div className="border-b border-rule px-5 py-3.5">
            <h2 className="text-[14px] font-medium text-ink">Recent stage changes</h2>
          </div>
          {data.recent_activity.length === 0 ? (
            <EmptyState title="No stage changes yet" icon={<ClipboardList size={18} />} />
          ) : (
            <ul className="divide-y divide-rule/80">
              {data.recent_activity.map((event, i) => (
                <li key={`${event.application_id}-${i}`} className="px-5 py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-graphite">
                    <Link to={`/applications/${event.application_id}`} className="font-medium text-ink hover:underline">{event.candidate_name}</Link>{' '}
                    moved to <span className="text-ink">{event.to_stage_name}</span>
                    {event.actor_name ? <> by {event.actor_name}</> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {event.job_title} · {timeAgo(event.created_at)}
                    {event.reason ? ` · ${event.reason}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isAdmin && data.data_requests.length > 0 && (
        <section className="card mt-5">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <h2 className="text-[14px] font-medium text-ink">Candidate data requests</h2>
            <Link to="/privacy-requests" className="text-[12.5px] text-accent underline underline-offset-2">Review</Link>
          </div>
          <ul className="divide-y divide-rule/80">
            {data.data_requests.map((request) => (
              <li key={request.id} className="flex items-center gap-3 px-5 py-3">
                <Badge tone={request.status === 'open' ? 'warning' : request.status === 'rejected' ? 'neutral' : 'success'}>
                  {STATUS_LABELS[request.status] || request.status}
                </Badge>
                <span className="text-[13px] text-ink">{request.candidate_name}</span>
                <span className="text-[12px] text-muted">{request.request_type === 'delete' ? 'deletion' : 'correction'} · {request.job_title}</span>
                <span className="ml-auto text-[11.5px] text-muted">{formatDateTime(request.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span>Signed in as {session?.user?.full_name} ({role?.replace('_', ' ')})</span>
        <span>·</span>
        <span>D1-backed, no automated candidate decisions.</span>
        <span>·</span>
        <Link to="/settings" className="underline underline-offset-2 hover:text-graphite">Workspace settings</Link>
      </p>
    </>
  );
}
