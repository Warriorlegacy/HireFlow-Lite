import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Info } from 'lucide-react';
import { api, download, errorMessage } from '../lib/api';
import { Button, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Select } from '../components/ui';
import type { Job } from '../types';

interface AnalyticsData {
  range: { from: number; to: number; days: number };
  totals: {
    applications: number;
    active: number;
    hired: number;
    rejected: number;
    withdrawn: number;
    interviews: number;
    scheduled_interviews: number;
    scorecards: number;
  };
  by_source: { source: string; count: number; share: number }[];
  stage_breakdown: { stage: string; kind: string; count: number }[];
  funnel: { stage: string; position: number; count: number; share: number }[];
  funnel_denominator: number;
  time_in_stage: { stage: string; average_days: number; samples: number }[];
  time_to_first_review_hours: number | null;
  first_review_samples: number;
  time_to_fill_days: number | null;
  time_to_fill_samples: number;
  interview_outcomes: Record<string, number>;
  workload: { owner: string; applications: number; active: number }[];
  trend: { date: string; applications: number }[];
  notes: string[];
}

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '180 days' },
];

export function AnalyticsPage() {
  const [days, setDays] = useState(90);
  const [jobId, setJobId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ jobs: Job[] }>('/jobs').then((d) => setJobs(d.jobs)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const from = Date.now() - days * 86_400_000;
      setData(await api<AnalyticsData>(`/analytics?from=${from}&to=${Date.now()}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [days]);

  const maxTrend = useMemo(() => Math.max(1, ...(data?.trend.map((t) => t.applications) || [1])), [data]);
  const maxFunnel = useMemo(() => Math.max(1, ...(data?.funnel.map((f) => f.count) || [1])), [data]);
  const maxSource = useMemo(() => Math.max(1, ...(data?.by_source.map((s) => s.count) || [1])), [data]);

  if (loading && !data) return <><PageHeader title="Analytics" /><LoadingBlock rows={7} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Real counts from the selected window. No demographic analysis, no predicted performance, no automated ranking."
        actions={
          <>
            <Select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-auto" aria-label="Role filter" disabled>
              <option value="">All roles</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </Select>
            <div className="flex rounded-md border border-rule bg-surface p-0.5" role="group" aria-label="Date range">
              {RANGES.map((range) => (
                <button key={range.days} onClick={() => setDays(range.days)} aria-pressed={days === range.days} className={`rounded px-2 py-1 text-[12px] ${days === range.days ? 'bg-accentSoft text-accentDark' : 'text-graphite'}`}>
                  {range.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Applications', value: data.totals.applications, note: `${data.totals.active} still active` },
          { label: 'Interviews held', value: data.totals.interviews, note: `${data.totals.scheduled_interviews} still scheduled` },
          { label: 'Scorecards', value: data.totals.scorecards, note: 'written by interviewers' },
          { label: 'Hires', value: data.totals.hired, note: `${data.totals.rejected} rejected · ${data.totals.withdrawn} withdrawn` },
        ].map((stat) => (
          <div key={stat.label} className="card px-4 py-4">
            <p className="text-[11.5px] text-muted">{stat.label}</p>
            <p className="mt-1.5 font-display text-[28px] leading-none text-ink">{stat.value}</p>
            <p className="mt-1.5 text-[11px] text-muted">{stat.note}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[19px] text-ink">Applications over time</h2>
            <span className="text-[11px] text-muted">{data.range.days} days</span>
          </div>
          <div className="mt-5 flex h-36 items-end gap-[2px]" role="img" aria-label="Applications per day">
            {data.trend.map((point) => (
              <div key={point.date} className="group relative flex-1">
                <div className="w-full rounded-t-[1px] bg-accent/60 transition-colors group-hover:bg-accent" style={{ height: `${Math.max(2, (point.applications / maxTrend) * 128)}px` }} />
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-rule bg-surface px-1.5 py-0.5 font-mono text-[10px] text-graphite group-hover:block">
                  {point.date} · {point.applications}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
            <span>{data.trend[0]?.date}</span>
            <span>{data.trend[data.trend.length - 1]?.date}</span>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-display text-[19px] text-ink">Funnel</h2>
          <p className="mt-1 text-[11.5px] text-muted">Share of the {data.funnel_denominator} applications that reached each stage at least once.</p>
          <div className="mt-4 space-y-3">
            {data.funnel.map((stage) => (
              <div key={stage.stage}>
                <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                  <span className="text-graphite">{stage.stage}</span>
                  <span className="font-mono text-[11px] text-muted">{stage.count} · {stage.share}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-accent/75" style={{ width: `${Math.max(1.5, (stage.count / maxFunnel) * 100)}%` }} />
                </div>
              </div>
            ))}
            {data.funnel.length === 0 && <p className="text-[12.5px] text-muted">No active stages configured.</p>}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-display text-[19px] text-ink">Where applications come from</h2>
          <div className="mt-4 space-y-3">
            {data.by_source.map((source) => (
              <div key={source.source}>
                <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                  <span className="capitalize text-graphite">{source.source.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-[11px] text-muted">{source.count} · {source.share}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-accent/60" style={{ width: `${(source.count / maxSource) * 100}%` }} />
                </div>
              </div>
            ))}
            {data.by_source.length === 0 && <p className="text-[12.5px] text-muted">No applications in this window.</p>}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-display text-[19px] text-ink">Time in stage</h2>
          <p className="mt-1 text-[11.5px] text-muted">Average days between consecutive stage events.</p>
          <div className="mt-4">
            {data.time_in_stage.length === 0 ? <p className="text-[12.5px] text-muted">Not enough stage transitions yet.</p> : (
              <table className="table-base">
                <thead><tr><th>Stage</th><th className="text-right">Average</th><th className="text-right">Samples</th></tr></thead>
                <tbody>
                  {data.time_in_stage.map((stage) => (
                    <tr key={stage.stage}>
                      <td className="text-[12.5px] text-graphite">{stage.stage}</td>
                      <td className="text-right font-mono text-[12px] text-ink">{stage.average_days}d</td>
                      <td className="text-right text-[11.5px] text-muted">{stage.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-display text-[19px] text-ink">Responsiveness</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11.5px] text-muted">First review</p>
              <p className="mt-1 font-display text-[26px] leading-none text-ink">{data.time_to_first_review_hours === null ? '—' : `${data.time_to_first_review_hours}h`}</p>
              <p className="mt-1 text-[11px] text-muted">{data.first_review_samples} applications measured</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted">Time to fill</p>
              <p className="mt-1 font-display text-[26px] leading-none text-ink">{data.time_to_fill_days === null ? '—' : `${data.time_to_fill_days}d`}</p>
              <p className="mt-1 text-[11px] text-muted">{data.time_to_fill_samples} hires measured</p>
            </div>
          </div>
          <div className="mt-5 border-t border-rule pt-3">
            <p className="text-[11.5px] text-muted">Interview recommendations</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              {Object.entries(data.interview_outcomes).map(([key, count]) => (
                <span key={key} className="text-graphite"><span className="font-mono text-[12px] text-ink">{count}</span> {key.replace('_', ' ')}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-display text-[19px] text-ink">Recruiter load</h2>
          <div className="mt-3">
            {data.workload.length === 0 ? <p className="text-[12.5px] text-muted">No assigned applications in this window.</p> : (
              <table className="table-base">
                <thead><tr><th>Owner</th><th className="text-right">Applications</th><th className="text-right">Active</th></tr></thead>
                <tbody>
                  {data.workload.map((row) => (
                    <tr key={row.owner}>
                      <td className="text-[12.5px] text-graphite">{row.owner}</td>
                      <td className="text-right font-mono text-[12px] text-ink">{row.applications}</td>
                      <td className="text-right font-mono text-[12px] text-muted">{row.active}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-card border border-rule bg-[#f4f0e6] p-4">
        <div className="flex items-start gap-2">
          <Info size={15} className="mt-0.5 shrink-0 text-graphite" />
          <div>
            <p className="text-[12.5px] font-medium text-ink">How to read this</p>
            <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-graphite">
              {data.notes.map((note) => <li key={note}>{note}</li>)}
              <li>Small samples are shown with their count so you do not over-read them.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={() => download('/api/v1/import-export/export', 'hireflow-applications.csv').catch((err) => alert(errorMessage(err)))}>
          Export underlying applications
        </Button>
        <Link to="/import-export" className="text-[12px] text-accent underline underline-offset-2 self-center">Import & export</Link>
      </div>
    </>
  );
}
