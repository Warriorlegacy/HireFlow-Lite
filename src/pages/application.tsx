import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MoveRight,
  Plus,
  ShieldCheck,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { api, download, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DefinitionList,
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
import {
  daysIn,
  fileSize,
  formatDate,
  formatDateTime,
  formatTime,
  inputToMs,
  msToLocalInput,
  ROLE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  timeAgo,
  workMode,
} from '../lib/format';
import type { ApplicationDetail, Job, Participant, Scorecard, Stage, Template } from '../types';

export function ApplicationPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [stageId, setStageId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [notePrivate, setNotePrivate] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState('status_update');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailPreview, setMailPreview] = useState<{ to: string; delivery_note: string; email_configured: boolean } | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [team, setTeam] = useState<{ user_id: string; full_name: string; role: string }[]>([]);
  const [interviewForm, setInterviewForm] = useState({
    title: 'Interview',
    format: 'video',
    start: msToLocalInput(Date.now() + 86_400_000),
    end: msToLocalInput(Date.now() + 86_400_000 + 3_600_000),
    meeting_url: '',
    candidate_notes: '',
  });
  const [participants, setParticipants] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; full_name: string }[]>([]);
  const [editForm, setEditForm] = useState({ owner_user_id: '', candidate_phone: '', candidate_location: '', candidate_linkedin_url: '', candidate_portfolio_url: '', source: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api<ApplicationDetail>(`/applications/${id}`);
      setData(detail);
      setStageId(detail.application.stage_id);
      setEditForm({
        owner_user_id: detail.application.owner_user_id || '',
        candidate_phone: detail.application.candidate?.phone || '',
        candidate_location: detail.application.candidate?.location || '',
        candidate_linkedin_url: detail.application.candidate?.linkedin_url || '',
        candidate_portfolio_url: detail.application.candidate?.portfolio_url || '',
        source: detail.application.source || '',
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const app = data?.application;
  const stages = data?.stages || [];
  const isInterviewPacket = data?.access === 'interview';
  const canEdit = data?.access === 'manage' || data?.access === 'edit';
  const canManage = data?.access === 'manage';

  const nextStages = useMemo(() => stages.filter((s) => s.id !== app?.stage_id), [stages, app?.stage_id]);
  const targetStage = stages.find((s) => s.id === stageId);

  async function moveStage() {
    if (!app) return;
    setBusy(true);
    try {
      await api(`/applications/${app.id}/stage`, { body: { stage_id: stageId, reason } });
      push(`Moved to ${targetStage?.name || 'new stage'}.`);
      setMoveOpen(false);
      setReason('');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!app || note.trim().length < 4) return;
    setBusy(true);
    try {
      await api(`/applications/${app.id}/feedback`, { body: { body: note.trim(), visibility: notePrivate ? 'private' : 'hiring_team' } });
      setNote('');
      setNotePrivate(false);
      push('Note added.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openMail() {
    setMailOpen(true);
    setMailPreview(null);
    try {
      const tpl = await api<{ templates: Template[] }>('/communications/templates');
      setTemplates(tpl.templates);
      const key = tpl.templates.some((t) => t.key === 'status_update') ? 'status_update' : tpl.templates[0]?.key;
      if (key) setTemplateKey(key);
      await previewMail(key || '');
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  }

  async function previewMail(key: string) {
    if (!app) return;
    try {
      const preview = await api<{ to: string; subject: string; body: string; delivery_note: string; email_configured: boolean }>('/communications/preview', {
        body: { application_id: app.id, template_key: key || undefined },
      });
      setMailSubject(preview.subject);
      setMailBody(preview.body);
      setMailPreview({ to: preview.to, delivery_note: preview.delivery_note, email_configured: preview.email_configured });
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  }

  async function sendMail() {
    if (!app) return;
    setBusy(true);
    try {
      const result = await api<{ status: string; message: string; error: string | null }>('/communications/send', {
        body: { application_id: app.id, subject: mailSubject, body: mailBody, confirm: true, template_key: templateKey || undefined },
      });
      push(result.message, result.status === 'sent' ? 'success' : result.status === 'failed' ? 'error' : 'info');
      setMailOpen(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function issuePortal() {
    if (!app) return;
    setBusy(true);
    try {
      const result = await api<{ url: string }>(`/applications/${app.id}/portal-link`, { method: 'POST' });
      setPortalUrl(result.url);
      setPortalOpen(true);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openSchedule() {
    if (!app) return;
    setScheduleOpen(true);
    try {
      const detail = await api<{ team: { user_id: string; full_name: string; role: string }[] }>(`/jobs/${app.job_id}`);
      setTeam(detail.team);
      setParticipants(detail.team.filter((t) => t.role === 'interviewer' || t.role === 'hiring_manager').map((t) => t.user_id).slice(0, 2));
    } catch {
      setTeam([]);
    }
  }

  async function scheduleInterview() {
    if (!app) return;
    setBusy(true);
    try {
      await api('/interviews', {
        body: {
          application_id: app.id,
          title: interviewForm.title,
          format: interviewForm.format,
          start_at: inputToMs(interviewForm.start),
          end_at: inputToMs(interviewForm.end),
          timezone: session?.org?.timezone || 'Asia/Kolkata',
          meeting_url: interviewForm.meeting_url || null,
          candidate_notes: interviewForm.candidate_notes || null,
          participants: participants.map((userId) => ({ user_id: userId, role: 'interviewer' })),
        },
      });
      push('Interview scheduled.');
      setScheduleOpen(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openEdit() {
    setEditOpen(true);
    try {
      const detail = await api<{ members: { id: string; full_name: string }[] }>('/jobs/meta/members');
      setOwnerOptions(detail.members);
    } catch {
      setOwnerOptions([]);
    }
  }

  async function saveEdit() {
    if (!app) return;
    setBusy(true);
    try {
      await api(`/applications/${app.id}`, {
        method: 'PATCH',
        body: {
          owner_user_id: editForm.owner_user_id || null,
          candidate_phone: editForm.candidate_phone || null,
          candidate_location: editForm.candidate_location || null,
          candidate_linkedin_url: editForm.candidate_linkedin_url || null,
          candidate_portfolio_url: editForm.candidate_portfolio_url || null,
          source: editForm.source || null,
        },
      });
      push('Application details updated.');
      setEditOpen(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyPortal() {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push('Copy failed. Select the link and copy it manually.', 'error');
    }
  }

  if (loading) return <LoadingBlock rows={8} />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!app) return null;

  if (isInterviewPacket) {
    return (
      <>
        <PageHeader
          title={app.candidate_name}
          back={<Link to="/interviews" className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft size={13} /> Interviews</Link>}
          description={`${app.job_title} · interview packet`}
          actions={<Link to={`/interviews/${data?.interviews?.[0]?.id || ''}`}><Button variant="primary">Open scorecard</Button></Link>}
        />
        <div className="card card-pad">
          <p className="text-[13px] leading-relaxed text-graphite">
            Your access is limited to the interviews you are assigned to. The candidate's resume, contact details and internal notes are not shown here.
          </p>
          <div className="mt-4">
            <DefinitionList
              items={[
                { label: 'Candidate', value: app.candidate_name },
                { label: 'Role', value: app.job_title },
                { label: 'Applied', value: formatDate(app.applied_at) },
                { label: 'Current stage', value: <span className="stamp">{app.stage_name}</span> },
              ]}
            />
          </div>
        </div>
        {data?.interviews?.length ? (
          <section className="mt-5 space-y-3">
            {data.interviews.map((interview) => (
              <div key={interview.id} className="card card-pad flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-ink">{interview.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{formatDateTime(interview.start_at, interview.timezone)} · {interview.format}</p>
                </div>
                <Link to={`/interviews/${interview.id}`}><Button size="sm">Open packet</Button></Link>
              </div>
            ))}
          </section>
        ) : null}
        {data?.my_scorecards?.length ? (
          <section className="card card-pad mt-5">
            <h2 className="font-display text-[18px] text-ink">Your scorecards</h2>
            {data.my_scorecards.map((scorecard) => (
              <p key={scorecard.id} className="mt-2 text-[13px] text-graphite">{STATUS_LABELS[scorecard.overall]} · {scorecard.summary}</p>
            ))}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={app.candidate_name}
        back={
          <Link to={`/jobs/${app.job_id}/pipeline`} className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
            <ArrowLeft size={13} /> {app.job_title} pipeline
          </Link>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="stamp">{app.stage_name}</span>
            <span>{app.job_title}</span>
            <span>·</span>
            <span>applied {formatDate(app.applied_at)}</span>
            <span>·</span>
            <span>{daysIn(app.stage_entered_at)} days in stage</span>
            {app.anonymized_at && <Badge tone="danger">Anonymised</Badge>}
          </span>
        }
        actions={
          <>
            {canEdit && <Button icon={<Mail size={14} />} onClick={openMail}>Message</Button>}
            {canEdit && <Button icon={<CalendarPlus size={14} />} onClick={openSchedule}>Schedule</Button>}
            {canEdit && <Button variant="primary" icon={<MoveRight size={14} />} onClick={() => setMoveOpen(true)}>Move stage</Button>}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <section className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] text-ink">Profile</h2>
                <p className="mt-0.5 text-[12px] text-muted">Candidate-provided details, kept only for this application.</p>
              </div>
              {canEdit && <Button size="sm" variant="ghost" onClick={openEdit}>Edit details</Button>}
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 text-[13.5px]">
                <p><span className="text-muted">Email </span><a className="text-accent underline underline-offset-2" href={`mailto:${app.candidate_email}`}>{app.candidate_email}</a></p>
                <p><span className="text-muted">Phone </span>{app.candidate?.phone || '—'}</p>
                <p><span className="text-muted">Location </span>{app.candidate?.location || '—'}</p>
              </div>
              <div className="space-y-2 text-[13.5px]">
                <p><span className="text-muted">Source </span>{SOURCE_LABELS[app.source || 'unknown'] || app.source || '—'}</p>
                <p><span className="text-muted">Owner </span>{data?.owner?.full_name || 'Unassigned'}</p>
                <p>
                  <span className="text-muted">Links </span>
                  {app.candidate?.linkedin_url || app.candidate?.portfolio_url ? (
                    <span className="inline-flex flex-wrap gap-3">
                      {app.candidate?.linkedin_url && <a href={app.candidate.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">LinkedIn <ExternalLink size={11} /></a>}
                      {app.candidate?.portfolio_url && <a href={app.candidate.portfolio_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Portfolio <ExternalLink size={11} /></a>}
                    </span>
                  ) : '—'}
                </p>
              </div>
            </div>

            {app.resume && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-paper/60 px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <FileText size={17} className="text-graphite" />
                  <div>
                    <p className="text-[12.5px] font-medium text-ink">{app.resume.original_filename}</p>
                    <p className="text-[11px] text-muted">{fileSize(app.resume.size_bytes)} · uploaded {formatDate(app.resume.created_at)} · private</p>
                  </div>
                </div>
                <Button size="sm" icon={<Download size={13} />} onClick={() => download(`/api/v1/applications/${app.id}/resume`, app.resume!.original_filename).catch((err) => push(errorMessage(err), 'error'))}>
                  Download
                </Button>
              </div>
            )}
            {!app.resume && <p className="mt-5 rounded-md border border-dashed border-rule px-3 py-3 text-[12px] text-muted">No resume is attached. Imported candidates may not have one.</p>}

            {app.cover_note && (
              <div className="mt-5">
                <h3 className="text-[12px] font-medium text-graphite">Cover note</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-graphite">{app.cover_note}</p>
              </div>
            )}

            {(app.answers?.length || 0) > 0 && (
              <div className="mt-5 space-y-3">
                {app.answers!.map((answer, i) => (
                  <div key={i}>
                    <h3 className="text-[12px] font-medium text-graphite">{answer.question}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-graphite">{answer.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[19px] text-ink">Stage history</h2>
            <p className="mt-0.5 text-[12px] text-muted">Immutable. Entries are append-only, including candidate withdrawals.</p>
            <ol className="mt-5 space-y-0">
              {(data?.history || []).map((event, index, list) => (
                <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < list.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-rule" aria-hidden />}
                  <span className="mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-accent bg-paper" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      {event.from_stage_name ? `${event.from_stage_name} → ` : ''}<span className="font-medium">{event.to_stage_name}</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      {formatDateTime(event.created_at)} · {event.actor_name || 'Candidate or system'}
                    </p>
                    {event.reason && <p className="mt-1 text-[12.5px] leading-relaxed text-graphite">{event.reason}</p>}
                  </div>
                </li>
              ))}
              {!data?.history?.length && <p className="text-[13px] text-muted">No stage changes recorded.</p>}
            </ol>
          </section>

          <section className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[19px] text-ink">Interview notes</h2>
              <Badge tone="neutral">{(data?.feedback || []).length}</Badge>
            </div>
            {canEdit && (
              <form onSubmit={addNote} className="mt-4">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you observe? Keep it specific and job-related." rows={3} aria-label="Add a note" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Checkbox label="Private to me" checked={notePrivate} onChange={(e) => setNotePrivate(e.target.checked)} />
                  <Button type="submit" size="sm" loading={busy} disabled={note.trim().length < 4} icon={<StickyNote size={13} />}>Add note</Button>
                </div>
              </form>
            )}
            <ul className="mt-4 space-y-3">
              {(data?.feedback || []).map((item) => (
                <li key={item.id} className="rounded-md border border-rule bg-paper/40 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={item.author_name} size={22} />
                    <span className="text-[12.5px] font-medium text-ink">{item.author_name}</span>
                    {item.visibility === 'private' && <Badge>Private</Badge>}
                    <span className="ml-auto text-[11px] text-muted">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-graphite">{item.body}</p>
                </li>
              ))}
              {!data?.feedback?.length && <p className="text-[12.5px] text-muted">No notes yet.</p>}
            </ul>
          </section>

          <section className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[19px] text-ink">Communication log</h2>
              <span className="text-[11.5px] text-muted">delivery is recorded honestly</span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {(data?.communications || []).map((item) => (
                <li key={item.id} className="rounded-md border border-rule px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}>
                      {item.status === 'sent' ? 'Sent' : item.status === 'failed' ? 'Failed' : 'Not sent'}
                    </Badge>
                    <span className="text-[12.5px] font-medium text-ink">{item.subject}</span>
                    <span className="ml-auto text-[11px] text-muted">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">To {item.to_email} · {item.provider || 'no provider'}</p>
                  {item.error && <p className="mt-1 text-[11.5px] leading-relaxed text-warning">{item.error}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11.5px] text-accent">Read message</summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-graphite">{item.body}</pre>
                  </details>
                </li>
              ))}
              {!data?.communications?.length && <p className="text-[12.5px] text-muted">No messages logged for this application.</p>}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Next step</h2>
            {canEdit ? (
              <div className="mt-3 space-y-2">
                <Button className="w-full" variant="primary" icon={<MoveRight size={14} />} onClick={() => setMoveOpen(true)}>Move to another stage</Button>
                <Button className="w-full" icon={<CalendarPlus size={14} />} onClick={openSchedule}>Schedule an interview</Button>
                <Button className="w-full" icon={<Mail size={14} />} onClick={openMail}>Prepare a message</Button>
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">You have read-only access to this application.</p>
            )}
            {app.status === 'rejected' && app.rejection_reason && (
              <p className="mt-3 rounded-md border border-negative/20 bg-negativeSoft/60 px-3 py-2 text-[12px] text-negative">Reason: {app.rejection_reason}</p>
            )}
            {app.withdrawn_at && (
              <p className="mt-3 rounded-md border border-rule bg-subtle/60 px-3 py-2 text-[12px] text-graphite">Withdrawn {formatDate(app.withdrawn_at)}. The record is retained under the retention policy.</p>
            )}
          </section>

          <section className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] text-ink">Interviews</h2>
              {canEdit && <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={openSchedule}>Add</Button>}
            </div>
            <ul className="mt-3 space-y-2">
              {(data?.interviews || []).map((interview) => (
                <li key={interview.id} className="rounded-md border border-rule px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/interviews/${interview.id}`} className="text-[12.5px] font-medium text-ink hover:underline">{interview.title}</Link>
                    <Badge tone={interview.status === 'completed' ? 'success' : interview.status === 'scheduled' ? 'accent' : 'neutral'}>{STATUS_LABELS[interview.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted">{formatDateTime(interview.start_at, interview.timezone)} · {interview.format}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {(interview.participants || []).map((p) => p.full_name).filter(Boolean).join(', ') || 'No interviewers assigned'}
                    {' · '}{interview.scorecard_count || 0} scorecard{(interview.scorecard_count || 0) === 1 ? '' : 's'}
                  </p>
                </li>
              ))}
              {!data?.interviews?.length && <p className="text-[12.5px] text-muted">No interviews scheduled.</p>}
            </ul>
          </section>

          {(data?.interviews || []).some((i) => (i.scorecards || []).length > 0) && (
            <section className="card card-pad">
              <h2 className="font-display text-[17px] text-ink">Scorecards</h2>
              <div className="mt-3 space-y-3">
                {(data?.interviews || []).flatMap((i) => (i.scorecards || []).map((s) => ({ ...s, interview: i }))).map((scorecard) => (
                  <div key={scorecard.id} className="rounded-md border border-rule px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] font-medium text-ink">{scorecard.interviewer_name}</p>
                      <Badge tone={scorecard.overall.includes('yes') ? 'success' : 'danger'}>{STATUS_LABELS[scorecard.overall]}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{scorecard.interview.title}</p>
                    {scorecard.summary && <p className="mt-1.5 text-[12.5px] leading-relaxed text-graphite">{scorecard.summary}</p>}
                    <Link to={`/interviews/${scorecard.interview.id}`} className="mt-2 inline-block text-[11.5px] text-accent underline underline-offset-2">Open full scorecard</Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Candidate portal</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              A private, expiring link where the candidate sees their stage, interviews and messages. It never exposes resumes or internal notes.
            </p>
            {app.portal_token && !app.portal_token.revoked_at && app.portal_token.expires_at > Date.now() ? (
              <p className="mt-2 text-[11.5px] text-graphite">
                Active link · expires {formatDate(app.portal_token.expires_at)}
                {app.portal_token.last_used_at ? ` · last opened ${timeAgo(app.portal_token.last_used_at)}` : ' · not opened yet'}
              </p>
            ) : (
              <p className="mt-2 text-[11.5px] text-muted">No active link.</p>
            )}
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={<Link2 size={13} />} loading={busy} onClick={issuePortal}>Issue new link</Button>
                {app.portal_token && !app.portal_token.revoked_at && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try {
                      await api(`/applications/${app.id}/portal-link/revoke`, { method: 'POST' });
                      push('Candidate link revoked.');
                      await load();
                    } catch (err) {
                      push(errorMessage(err), 'error');
                    }
                  }}>Revoke</Button>
                )}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">Issuing a new link revokes the previous one. Links expire after 90 days.</p>
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Consent & retention</h2>
            <div className="mt-3">
              <DefinitionList
                items={[
                  { label: 'Consent', value: app.consent?.granted ? <span className="inline-flex items-center gap-1 text-positive"><ShieldCheck size={13} /> Given {formatDate(app.consent.created_at)}</span> : 'Not recorded' },
                  { label: 'Notice version', value: app.consent?.notice_version || '—' },
                  { label: 'Withdrawn', value: app.consent?.withdrawn_at ? formatDate(app.consent.withdrawn_at) : 'No' },
                  { label: 'Retention', value: `${session?.org?.default_retention_days || 365} days` },
                ]}
              />
            </div>
            {app.anonymized_at && <p className="mt-3 text-[11.5px] text-negative">This record was anonymised on {formatDate(app.anonymized_at)}.</p>}
            {(app.deletion_requests || []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {app.deletion_requests!.map((request) => (
                  <p key={request.id} className="text-[11.5px] text-graphite">
                    Candidate {request.request_type} request · <Badge tone={request.status === 'open' ? 'warning' : request.status === 'rejected' ? 'neutral' : 'success'}>{STATUS_LABELS[request.status]}</Badge>
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Move ${app.candidate_name}`}
        description={`Currently in ${app.stage_name}. This writes an immutable stage event.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!stageId || stageId === app.stage_id || (targetStage?.kind === 'rejected' && !reason.trim())} onClick={moveStage}>Confirm move</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New stage">
            <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {nextStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </Select>
          </Field>
          <Field label="Reason" hint={targetStage?.kind === 'rejected' ? 'Required for rejection. The candidate may request this reason.' : 'Shown in the application history.'}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={mailOpen}
        onClose={() => setMailOpen(false)}
        title="Prepare a message"
        description={mailPreview?.delivery_note}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMailOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={sendMail}>{mailPreview?.email_configured ? 'Send email' : 'Save to log'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Template">
              <Select value={templateKey} onChange={(e) => { setTemplateKey(e.target.value); void previewMail(e.target.value); }}>
                {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="To">
              <Input value={mailPreview?.to || app.candidate_email} readOnly />
            </Field>
          </div>
          <Field label="Subject"><Input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} /></Field>
          <Field label="Message"><Textarea rows={12} value={mailBody} onChange={(e) => setMailBody(e.target.value)} /></Field>
          {!mailPreview?.email_configured && (
            <p className="rounded-md border border-warning/25 bg-warningSoft/60 px-3 py-2 text-[12px] leading-relaxed text-warning">
              No email provider is configured in this deployment. Saving records the message in the application log and clearly marks it as not sent.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={portalOpen}
        onClose={() => setPortalOpen(false)}
        title="Candidate status link"
        description="Copy this link and share it directly with the candidate. It is shown once and cannot be recovered."
        footer={<Button variant="primary" onClick={() => setPortalOpen(false)}>Done</Button>}
      >
        <div className="rounded-md border border-rule bg-paper/70 p-3">
          <p className="break-all font-mono text-[11.5px] text-graphite">{portalUrl}</p>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copyPortal}>{copied ? 'Copied' : 'Copy link'}</Button>
          <a href={portalUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" icon={<ExternalLink size={13} />}>Preview</Button></a>
        </div>
      </Modal>

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule an interview"
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={scheduleInterview}>Schedule</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title"><Input value={interviewForm.title} onChange={(e) => setInterviewForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Format">
              <Select value={interviewForm.format} onChange={(e) => setInterviewForm((f) => ({ ...f, format: e.target.value }))}>
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="onsite">On-site</option>
              </Select>
            </Field>
            <Field label="Starts"><Input type="datetime-local" value={interviewForm.start} onChange={(e) => setInterviewForm((f) => ({ ...f, start: e.target.value }))} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={interviewForm.end} onChange={(e) => setInterviewForm((f) => ({ ...f, end: e.target.value }))} /></Field>
          </div>
          <Field label="Meeting link" hint="Optional. Shown to the candidate in their portal.">
            <Input value={interviewForm.meeting_url} onChange={(e) => setInterviewForm((f) => ({ ...f, meeting_url: e.target.value }))} placeholder="https://meet.example.test/..." />
          </Field>
          <Field label="Note for the candidate" hint="What to expect, who they will meet, and preparation.">
            <Textarea rows={3} value={interviewForm.candidate_notes} onChange={(e) => setInterviewForm((f) => ({ ...f, candidate_notes: e.target.value }))} />
          </Field>
          <Field label="Interviewers" hint="Only these people receive the interview packet.">
            {team.length === 0 ? <p className="text-[12px] text-muted">No hiring team found. Add interviewers on the role first.</p> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {team.map((member) => (
                  <Checkbox
                    key={member.user_id}
                    label={<span>{member.full_name} <span className="text-muted">· {ROLE_LABELS[member.role] || member.role}</span></span>}
                    checked={participants.includes(member.user_id)}
                    onChange={(e) => setParticipants((p) => e.target.checked ? [...p, member.user_id] : p.filter((x) => x !== member.user_id))}
                  />
                ))}
              </div>
            )}
          </Field>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit application details"
        footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={saveEdit}>Save</Button></>}
      >
        <div className="space-y-4">
          <Field label="Owner">
            <Select value={editForm.owner_user_id} onChange={(e) => setEditForm((f) => ({ ...f, owner_user_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {ownerOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone"><Input value={editForm.candidate_phone} onChange={(e) => setEditForm((f) => ({ ...f, candidate_phone: e.target.value }))} /></Field>
            <Field label="Location"><Input value={editForm.candidate_location} onChange={(e) => setEditForm((f) => ({ ...f, candidate_location: e.target.value }))} /></Field>
            <Field label="LinkedIn"><Input value={editForm.candidate_linkedin_url} onChange={(e) => setEditForm((f) => ({ ...f, candidate_linkedin_url: e.target.value }))} /></Field>
            <Field label="Portfolio"><Input value={editForm.candidate_portfolio_url} onChange={(e) => setEditForm((f) => ({ ...f, candidate_portfolio_url: e.target.value }))} /></Field>
          </div>
          <Field label="Source">
            <Select value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
