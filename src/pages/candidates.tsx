import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Avatar, Badge, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Select } from '../components/ui';
import { daysIn, formatDate, SOURCE_LABELS, STATUS_LABELS } from '../lib/format';
import type { ApplicationListItem, Job } from '../types';

export function CandidatesPage() {
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [jobId, setJobId] = useState('');
  const [source, setSource] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status, limit: '100' });
      if (jobId) params.set('job_id', jobId);
      if (source) params.set('source', source);
      if (query.trim()) params.set('q', query.trim());
      const [data, jobData] = await Promise.all([
        api<{ applications: ApplicationListItem[] }>(`/applications?${params.toString()}`),
        api<{ jobs: Job[] }>('/jobs').catch(() => ({ jobs: [] as Job[] })),
      ]);
      setApps(data.applications);
      setJobs(jobData.jobs);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void load(), 220);
    return () => clearTimeout(timer);
  }, [status, jobId, source, query]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const job of jobs) void job;
    for (const app of apps) if (app.source) set.add(app.source);
    return [...set].sort();
  }, [apps, jobs]);

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Every application across the roles you can see. Search by name, email or role."
      />

      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_160px_150px_150px]">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates or roles" className="pl-8" aria-label="Search candidates" />
        </div>
        <Select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="active">Active</option>
          <option value="all">All statuses</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </Select>
        <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
          <option value="">All sources</option>
          {sources.map((key) => <option key={key} value={key}>{SOURCE_LABELS[key] || key}</option>)}
        </Select>
      </div>

      {loading ? <LoadingBlock rows={6} /> : error ? <ErrorBlock message={error} onRetry={load} /> : apps.length === 0 ? (
        <div className="card">
          <EmptyState title="No candidates match" icon={<Users size={18} />}>Try removing a filter, or publish a role to start collecting applications.</EmptyState>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base min-w-[820px]">
              <thead>
                <tr>
                  <th className="pl-5">Candidate</th>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Applied</th>
                  <th>In stage</th>
                  <th className="pr-5">Owner</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.id} className="hover:bg-paper/50">
                    <td className="pl-5">
                      <Link to={`/applications/${app.id}`} className="flex items-center gap-2.5">
                        <Avatar name={app.candidate_name} size={26} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{app.candidate_name}</span>
                          <span className="block truncate text-[11px] text-muted">{app.candidate_email}</span>
                        </span>
                      </Link>
                    </td>
                    <td><Link to={`/jobs/${app.job_id}`} className="text-[12.5px] text-graphite hover:underline">{app.job_title}</Link></td>
                    <td><span className="text-[12.5px] text-graphite">{app.stage_name}</span></td>
                    <td><Badge tone={app.status === 'hired' ? 'success' : app.status === 'rejected' ? 'danger' : app.status === 'withdrawn' ? 'neutral' : 'accent'}>{STATUS_LABELS[app.status]}</Badge></td>
                    <td className="text-[12px] text-muted">{SOURCE_LABELS[app.source || 'unknown'] || app.source || '—'}</td>
                    <td className="text-[12px] text-muted">{formatDate(app.applied_at)}</td>
                    <td className={`text-[12px] ${daysIn(app.stage_entered_at) >= 7 && app.status === 'active' ? 'text-warning' : 'text-muted'}`}>{daysIn(app.stage_entered_at)}d</td>
                    <td className="pr-5 text-[12px] text-muted">{app.owner_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-rule px-5 py-2.5 text-[11.5px] text-muted">{apps.length} application{apps.length === 1 ? '' : 's'} shown · newest first</div>
        </div>
      )}
    </>
  );
}
