import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LayoutGrid, List, MoveRight, Search, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '../components/ui';
import { daysIn, formatDate, SOURCE_LABELS, STATUS_LABELS } from '../lib/format';
import type { ApplicationListItem, Job, Stage } from '../types';

interface JobDetailLite {
  job: Job;
  stages: Stage[];
  access: string;
}

export function PipelinePage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { push } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [moving, setMoving] = useState<ApplicationListItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [targetStage, setTargetStage] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const role = session?.membership?.role;
  const canMove = role !== 'interviewer';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api<JobDetailLite>(`/jobs/${id}`);
      setJob(detail.job);
      setStages(detail.stages);
      const data = await api<{ applications: ApplicationListItem[] }>(`/applications?job_id=${id}&status=${statusFilter}&limit=100&sort=stage_age`);
      setApps(data.applications);
      setTargetStage(detail.stages.find((s) => s.kind === 'active')?.id || detail.stages[0]?.id || '');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.candidate_name.toLowerCase().includes(q) || a.candidate_email.toLowerCase().includes(q));
  }, [apps, query]);

  const byStage = useMemo(() => {
    const map = new Map<string, ApplicationListItem[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const app of filtered) {
      if (!map.has(app.stage_id)) map.set(app.stage_id, []);
      map.get(app.stage_id)!.push(app);
    }
    return map;
  }, [filtered, stages]);

  async function move(app: ApplicationListItem, stageId: string, note: string) {
    setBusy(true);
    try {
      await api(`/applications/${app.id}/stage`, { body: { stage_id: stageId, reason: note } });
      const stage = stages.find((s) => s.id === stageId);
      push(`${app.candidate_name} moved to ${stage?.name || 'the new stage'}.`);
      setMoving(null);
      setReason('');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function bulkMove() {
    const list = apps.filter((a) => selected.has(a.id));
    if (!list.length || !targetStage) return;
    setBusy(true);
    const results = await Promise.allSettled(
      list.map((app) => api(`/applications/${app.id}/stage`, { body: { stage_id: targetStage, reason } })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    setBusy(false);
    setBulkOpen(false);
    setSelected(new Set());
    setReason('');
    push(failed ? `${ok} moved, ${failed} failed. Check the reasons and try again.` : `${ok} applications moved.`, failed ? 'error' : 'success');
    await load();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && !job) return <LoadingBlock rows={6} />;
  if (error && !job) return <ErrorBlock message={error} onRetry={load} />;
  if (!job) return null;

  const stagesForMove = stages.filter((s) => s.id !== moving?.stage_id);
  const selectedApps = apps.filter((a) => selected.has(a.id));

  return (
    <>
      <PageHeader
        title={job.title}
        back={<Link to={`/jobs/${job.id}`} className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft size={13} /> {job.title}</Link>}
        description={<span className="flex flex-wrap items-center gap-2"><span>Pipeline — every move is recorded with who, when and why.</span></span>}
        actions={
          <>
            <div className="flex rounded-md border border-rule bg-surface p-0.5" role="group" aria-label="View">
              <button onClick={() => setView('board')} className={`flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] ${view === 'board' ? 'bg-accentSoft text-accentDark' : 'text-graphite'}`} aria-pressed={view === 'board'}>
                <LayoutGrid size={13} /> Board
              </button>
              <button onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] ${view === 'list' ? 'bg-accentSoft text-accentDark' : 'text-graphite'}`} aria-pressed={view === 'list'}>
                <List size={13} /> List
              </button>
            </div>
            <Link to={`/jobs/${job.id}`}><Button size="sm">Role overview</Button></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates" className="pl-8" aria-label="Search candidates" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto" aria-label="Application status">
          <option value="active">Active applications</option>
          <option value="all">All applications</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </Select>
        <span className="text-[12px] text-muted">{filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState title="No applications in this view" icon={<Users size={18} />}>
            {statusFilter === 'active' ? 'New applications appear in the New stage as soon as they arrive.' : 'Try a different status or clear the search.'}
          </EmptyState>
        </div>
      ) : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const rows = byStage.get(stage.id) || [];
            return (
              <section key={stage.id} className="flex w-[248px] shrink-0 flex-col rounded-card border border-rule bg-[#f2eee4]/70" aria-label={`${stage.name} stage`}>
                <header className="flex items-center justify-between px-3 py-2.5">
                  <h2 className="text-[12.5px] font-medium text-ink">{stage.name}</h2>
                  <span className="font-mono text-[11px] text-muted">{rows.length}</span>
                </header>
                <div className="min-h-[120px] flex-1 space-y-2 px-2 pb-3">
                  {rows.map((app) => (
                    <article key={app.id} className="rounded-md border border-rule bg-surface p-2.5 shadow-sm">
                      <div className="flex items-start gap-2">
                        <Avatar name={app.candidate_name} size={24} />
                        <div className="min-w-0 flex-1">
                          <Link to={`/applications/${app.id}`} className="block truncate text-[12.5px] font-medium text-ink hover:underline">
                            {app.candidate_name}
                          </Link>
                          <p className="mt-0.5 text-[10.5px] text-muted">{SOURCE_LABELS[app.source || 'unknown'] || app.source}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted">
                        <span>{daysIn(app.stage_entered_at)}d in stage</span>
                        <span className="flex items-center gap-1">
                          {app.interview_count > 0 && <span className="font-mono">{app.interview_count} iv</span>}
                          {app.feedback_count > 0 && <span className="font-mono">{app.feedback_count} notes</span>}
                        </span>
                      </div>
                      {canMove && (
                        <div className="mt-2 flex items-center gap-1 border-t border-rule/70 pt-2">
                          <button onClick={() => { setMoving(app); setTargetStage(stagesForMove.find((s) => s.kind === 'active')?.id || stages[0]?.id || ''); }} className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10.5px] text-accent hover:bg-accentSoft" aria-label={`Move ${app.candidate_name}`}>
                            <MoveRight size={11} /> Move
                          </button>
                          <Link to={`/applications/${app.id}`} className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] text-muted hover:text-ink">
                            Open <ArrowRight size={10} />
                          </Link>
                        </div>
                      )}
                    </article>
                  ))}
                  {rows.length === 0 && <p className="px-1 py-4 text-center text-[11px] text-muted/80">Empty</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-accentSoft/60 px-4 py-2.5">
              <span className="text-[12.5px] text-accentDark">{selected.size} selected</span>
              <Button size="sm" variant="primary" className="ml-auto" onClick={() => setBulkOpen(true)}>Move selected</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="table-base min-w-[760px]">
              <thead>
                <tr className="px-4">
                  <th className="w-8 py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      className="h-3.5 w-3.5 accent-accent"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((a) => a.id)) : new Set())}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Applied</th>
                  <th>Owner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-paper/60">
                    <td className="pl-4">
                      <input type="checkbox" aria-label={`Select ${app.candidate_name}`} className="h-3.5 w-3.5 accent-accent" checked={selected.has(app.id)} onChange={() => toggle(app.id)} />
                    </td>
                    <td>
                      <Link to={`/applications/${app.id}`} className="font-medium text-ink hover:underline">{app.candidate_name}</Link>
                      <p className="text-[11.5px] text-muted">{app.candidate_email}</p>
                    </td>
                    <td><span className="text-[12.5px] text-graphite">{app.stage_name}</span></td>
                    <td><Badge tone={app.status === 'hired' ? 'success' : app.status === 'rejected' ? 'danger' : app.status === 'withdrawn' ? 'neutral' : 'accent'}>{STATUS_LABELS[app.status]}</Badge></td>
                    <td className="text-[12px] text-muted">{SOURCE_LABELS[app.source || 'unknown'] || app.source}</td>
                    <td className="text-[12px] text-muted">{formatDate(app.applied_at)}</td>
                    <td className="text-[12px] text-muted">{app.owner_name || '—'}</td>
                    <td className="pr-4 text-right">
                      {canMove && <Button size="sm" variant="ghost" onClick={() => setMoving(app)} aria-label={`Move ${app.candidate_name}`}><MoveRight size={13} /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(moving)}
        onClose={() => { setMoving(null); setReason(''); }}
        title={moving ? `Move ${moving.candidate_name}` : 'Move application'}
        description={moving ? `Currently in ${moving.stage_name}. The change is written to the application history.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setMoving(null); setReason(''); }}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!targetStage || (stages.find((s) => s.id === targetStage)?.kind === 'rejected' && !reason.trim())}
              onClick={() => moving && move(moving, targetStage, reason)}
            >
              Confirm move
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New stage">
            <Select value={targetStage} onChange={(e) => setTargetStage(e.target.value)}>
              {stagesForMove.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="Reason"
            hint={stages.find((s) => s.id === targetStage)?.kind === 'rejected' ? 'Required for a rejection. The candidate may ask for it.' : 'Optional context for the hiring team.'}
          >
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Portfolio review passed; schedule a craft interview." />
          </Field>
          {moving && (
            <div className="rounded-md border border-rule bg-paper/60 px-3 py-2 text-[12px] text-muted">
              {moving.candidate_name} · {moving.job_title} · applied {formatDate(moving.applied_at)}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`Move ${selectedApps.length} applications`}
        description="Review the list before confirming. Each application gets its own immutable stage event."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!targetStage} onClick={bulkMove}>Confirm {selectedApps.length} moves</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Move to stage">
            <Select value={targetStage} onChange={(e) => setTargetStage(e.target.value)}>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </Select>
          </Field>
          <Field label="Reason" hint="Applied to every record in this batch.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
          <div className="max-h-56 overflow-y-auto rounded-md border border-rule">
            {selectedApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between border-b border-rule/60 px-3 py-2 text-[12.5px] last:border-b-0">
                <span className="text-ink">{app.candidate_name}</span>
                <span className="text-muted">from {app.stage_name}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}

