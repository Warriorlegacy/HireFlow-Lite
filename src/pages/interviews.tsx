import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CalendarPlus, Check, Clock, Download, ExternalLink, MapPin, Video } from 'lucide-react';
import { api, download, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
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
import { formatDate, formatDateTime, formatTime, STATUS_LABELS } from '../lib/format';
import type { Interview, Participant, Scorecard, ScorecardTemplate } from '../types';

interface InterviewListRow extends Interview {
  candidate_name: string;
  job_title: string;
  participant_count: number;
  scorecard_count: number;
}

export function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ interviews: InterviewListRow[] }>('/interviews');
      setInterviews(data.interviews);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (scope === 'upcoming') return interviews.filter((i) => i.start_at >= now && i.status === 'scheduled');
    if (scope === 'past') return interviews.filter((i) => i.start_at < now || i.status !== 'scheduled');
    return interviews;
  }, [interviews, scope]);

  const grouped = useMemo(() => {
    const map = new Map<string, InterviewListRow[]>();
    for (const interview of filtered) {
      const key = new Date(interview.start_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(interview);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Scheduled conversations across your roles. Interviewers see only the packets they are assigned to."
        actions={<Link to="/jobs"><Button icon={<CalendarPlus size={14} />}>Schedule from a role</Button></Link>}
      />

      <div className="mb-5 flex gap-1.5" role="tablist">
        {([['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={`rounded-md px-2.5 py-1.5 text-[12.5px] ${scope === key ? 'bg-accentSoft font-medium text-accentDark' : 'text-graphite hover:bg-subtle'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <LoadingBlock rows={5} /> : error ? <ErrorBlock message={error} onRetry={load} /> : filtered.length === 0 ? (
        <div className="card">
          <EmptyState title={scope === 'upcoming' ? 'No upcoming interviews' : 'No interviews here'} icon={<CalendarDays size={18} />}>
            Open an application and choose “Schedule an interview”. Interviewers are selected per conversation.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(([day, rows]) => (
            <section key={day}>
              <h2 className="mb-2 text-[12px] font-medium text-muted">{day}</h2>
              <ul className="card divide-y divide-rule/80 overflow-hidden">
                {rows.map((interview) => {
                  const start = interview.start_at;
                  return (
                    <li key={interview.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                      <div className="flex w-[92px] shrink-0 items-center gap-2.5">
                        <div className="w-[62px] rounded-md border border-rule bg-[#f4f0e6] px-1.5 py-1 text-center">
                          <p className="font-mono text-[11px] text-graphite">{formatTime(start, interview.timezone)}</p>
                          <p className="text-[10px] text-muted">{Math.round((interview.end_at - start) / 60_000)} min</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/interviews/${interview.id}`} className="text-[13.5px] font-medium text-ink hover:underline">{interview.title}</Link>
                          <Badge tone={interview.status === 'scheduled' ? 'accent' : interview.status === 'completed' ? 'success' : 'neutral'}>{STATUS_LABELS[interview.status]}</Badge>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-graphite">{interview.candidate_name} · {interview.job_title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
                          <span className="inline-flex items-center gap-1">{interview.format === 'video' ? <Video size={11} /> : interview.format === 'phone' ? <Clock size={11} /> : <MapPin size={11} />} {interview.format}</span>
                          <span>{interview.participant_count} interviewer{interview.participant_count === 1 ? '' : 's'}</span>
                          <span>{interview.scorecard_count} scorecard{interview.scorecard_count === 1 ? '' : 's'}</span>
                        </p>
                      </div>
                      <Link to={`/interviews/${interview.id}`}><Button size="sm">Open packet</Button></Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

interface InterviewDetail {
  access: 'manage' | 'edit' | 'view' | 'participant';
  interview: Interview & { candidate_name: string; candidate_email: string; job_title: string; job_slug: string; department: string; application_id: string };
  participants: Participant[];
  candidate: {
    full_name: string;
    email?: string;
    location?: string | null;
    portfolio_url?: string | null;
    linkedin_url?: string | null;
    cover_note?: string | null;
    source?: string | null;
    applied_at?: number;
    stage_id?: string;
    resume_id?: string | null;
  };
  scorecard_template: ScorecardTemplate | null;
  scorecards: Scorecard[];
  my_participation: Participant | null;
}

const OVERALLS = [
  { key: 'strong_yes', label: 'Strong yes', tone: 'success' as const },
  { key: 'yes', label: 'Yes', tone: 'success' as const },
  { key: 'no', label: 'No', tone: 'danger' as const },
  { key: 'strong_no', label: 'Strong no', tone: 'danger' as const },
];

export function InterviewPage() {
  const { id } = useParams();
  const { push } = useToast();
  const [data, setData] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState<'strong_yes' | 'yes' | 'no' | 'strong_no'>('yes');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api<InterviewDetail>(`/interviews/${id}`);
      setData(detail);
      const mine = detail.scorecards.find((s) => s.interviewer_user_id === detail.my_participation?.user_id);
      if (mine) {
        setOverall(mine.overall);
        setSummary(mine.summary || '');
        const r: Record<string, number> = {};
        const e: Record<string, string> = {};
        for (const response of mine.responses || []) {
          r[response.item_id] = response.rating;
          e[response.item_id] = response.evidence || '';
        }
        setRatings(r);
        setEvidence(e);
      }
      setNewStart(new Date(detail.interview.start_at - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
      setNewEnd(new Date(detail.interview.end_at - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  async function submitScorecard(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const items = data.scorecard_template?.items || [];
    if (items.some((item) => !ratings[item.id])) {
      push('Rate every competency before submitting.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/interviews/${data.interview.id}/scorecard`, {
        body: {
          overall,
          summary,
          responses: items.map((item) => ({ item_id: item.id, rating: ratings[item.id], evidence: evidence[item.id] || null })),
        },
      });
      push('Scorecard submitted. Thank you.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    if (!data) return;
    setBusy(true);
    try {
      await api(`/interviews/${data.interview.id}`, { method: 'PATCH', body: { status } });
      push(`Interview marked ${STATUS_LABELS[status].toLowerCase()}.`);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!data) return;
    setBusy(true);
    try {
      await api(`/interviews/${data.interview.id}`, {
        method: 'PATCH',
        body: { start_at: new Date(newStart).getTime(), end_at: new Date(newEnd).getTime() },
      });
      push('Interview rescheduled.');
      setRescheduleOpen(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return null;
  const interview = data.interview;
  const isParticipant = data.access === 'participant';
  const canManage = data.access === 'manage' || data.access === 'edit' || data.access === 'view';
  const items = data.scorecard_template?.items || [];
  const myScorecard = data.scorecards.find((s) => s.interviewer_user_id === data.my_participation?.user_id);
  const canSubmit = Boolean(data.my_participation) && interview.status !== 'cancelled';

  return (
    <>
      <PageHeader
        title={interview.title}
        back={<Link to="/interviews" className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft size={13} /> Interviews</Link>}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={interview.status === 'scheduled' ? 'accent' : interview.status === 'completed' ? 'success' : 'neutral'}>{STATUS_LABELS[interview.status]}</Badge>
            <span>{formatDateTime(interview.start_at, interview.timezone)}</span>
            <span>· {interview.format}</span>
            <span>· {interview.job_title}</span>
          </span>
        }
        actions={
          <>
            <Button icon={<Download size={14} />} onClick={() => download(`/api/v1/interviews/${interview.id}/calendar.ics`, 'interview.ics').catch((err) => push(errorMessage(err), 'error'))}>Calendar</Button>
            {canManage && <Button icon={<CalendarDays size={14} />} onClick={() => setRescheduleOpen(true)}>Reschedule</Button>}
            {canManage && interview.status === 'scheduled' && <Button variant="primary" loading={busy} onClick={() => setStatus('completed')}>Mark completed</Button>}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[19px] text-ink">Candidate brief</h2>
            <div className="mt-3">
              <DefinitionList
                items={[
                  { label: 'Candidate', value: data.candidate.full_name },
                  ...(isParticipant ? [] : [{ label: 'Email', value: data.candidate.email }]),
                  { label: 'Role', value: interview.job_title },
                  ...(isParticipant ? [] : [{ label: 'Location', value: data.candidate.location }]),
                  ...(isParticipant ? [] : [{ label: 'Source', value: data.candidate.source || '—' }]),
                  ...(isParticipant ? [] : [{ label: 'Applied', value: data.candidate.applied_at ? formatDate(data.candidate.applied_at) : '—' }]),
                ]}
              />
            </div>
            {!isParticipant && data.candidate.cover_note && (
              <div className="mt-4 rounded-md border border-rule bg-paper/60 px-3.5 py-3">
                <p className="text-[11.5px] font-medium text-graphite">Cover note</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-graphite">{data.candidate.cover_note}</p>
              </div>
            )}
            {!isParticipant && (data.candidate.linkedin_url || data.candidate.portfolio_url) && (
              <div className="mt-3 flex gap-4 text-[12.5px]">
                {data.candidate.linkedin_url && <a href={data.candidate.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">LinkedIn <ExternalLink size={11} /></a>}
                {data.candidate.portfolio_url && <a href={data.candidate.portfolio_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Portfolio <ExternalLink size={11} /></a>}
              </div>
            )}
            {interview.candidate_notes && (
              <div className="mt-4">
                <p className="text-[11.5px] font-medium text-graphite">Note shared with the candidate</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-graphite">{interview.candidate_notes}</p>
              </div>
            )}
            {interview.meeting_url && (
              <a href={interview.meeting_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-accent underline underline-offset-2">
                <Video size={13} /> Join meeting
              </a>
            )}
          </section>

          <section className="card card-pad">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] text-ink">Interview scorecard</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  {data.scorecard_template
                    ? 'Rate each competency from 1 to 5 and record the evidence you heard. Anchors describe the scale.'
                    : 'No scorecard template exists for this role yet. Ask the hiring owner to add competencies on the role page.'}
                </p>
              </div>
              {myScorecard && <Badge tone="success">Submitted</Badge>}
            </div>

            {!canSubmit ? (
              <p className="mt-4 rounded-md border border-rule bg-paper/60 px-3 py-3 text-[12.5px] text-muted">
                Only assigned interviewers can submit a scorecard. You can still read the brief.
              </p>
            ) : items.length === 0 ? null : (
              <form onSubmit={submitScorecard} className="mt-5 space-y-5">
                {items.map((item) => (
                  <fieldset key={item.id} className="rounded-md border border-rule p-3.5">
                    <legend className="px-1 text-[13px] font-medium text-ink">{item.competency}</legend>
                    {item.description && <p className="mb-2 text-[11.5px] leading-relaxed text-muted">{item.description}</p>}
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${item.competency} rating`}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} className={`cursor-pointer rounded-md border px-2.5 py-1 text-[12px] ${ratings[item.id] === value ? 'border-accent bg-accentSoft text-accentDark' : 'border-rule bg-surface text-graphite hover:bg-subtle'}`}>
                          <input type="radio" name={`rating-${item.id}`} value={value} checked={ratings[item.id] === value} onChange={() => setRatings((r) => ({ ...r, [item.id]: value }))} className="sr-only" />
                          {value}
                        </label>
                      ))}
                      {item.anchors['1'] && <span className="ml-1 self-center text-[10.5px] text-muted">1 = {item.anchors['1']}</span>}
                    </div>
                    <Textarea
                      className="mt-2.5"
                      rows={2}
                      value={evidence[item.id] || ''}
                      onChange={(e) => setEvidence((v) => ({ ...v, [item.id]: e.target.value }))}
                      placeholder="Evidence: what the candidate said or did."
                      aria-label={`Evidence for ${item.competency}`}
                    />
                  </fieldset>
                ))}

                <Field label="Overall recommendation">
                  <div className="flex flex-wrap gap-2">
                    {OVERALLS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setOverall(option.key as typeof overall)}
                        aria-pressed={overall === option.key}
                        className={`rounded-md border px-2.5 py-1.5 text-[12.5px] ${overall === option.key ? 'border-accent bg-accentSoft text-accentDark' : 'border-rule bg-surface text-graphite hover:bg-subtle'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Summary" hint="A few sentences a debrief can rely on.">
                  <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted">This is a human judgement, not an automated score.</p>
                  <Button type="submit" variant="primary" loading={busy} icon={<Check size={14} />}>{myScorecard ? 'Update scorecard' : 'Submit scorecard'}</Button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Logistics</h2>
            <div className="mt-3">
              <DefinitionList
                items={[
                  { label: 'Starts', value: formatDateTime(interview.start_at, interview.timezone) },
                  { label: 'Ends', value: formatDateTime(interview.end_at, interview.timezone) },
                  { label: 'Timezone', value: interview.timezone },
                  { label: 'Format', value: interview.format },
                  { label: 'Location', value: interview.location || interview.meeting_url || '—' },
                ]}
              />
            </div>
            {canManage && interview.status !== 'cancelled' && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-3">
                <Button size="sm" variant="ghost" onClick={() => setStatus('scheduled')}>Mark scheduled</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus('no_show')}>No show</Button>
                <Button size="sm" variant="danger" onClick={() => setStatus('cancelled')}>Cancel interview</Button>
              </div>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Interviewers</h2>
            <ul className="mt-3 space-y-2">
              {data.participants.map((participant) => (
                <li key={participant.user_id} className="flex items-center gap-2.5">
                  <Avatar name={participant.full_name || ''} size={26} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-ink">{participant.full_name}</p>
                    <p className="text-[11px] capitalize text-muted">{participant.role}</p>
                  </div>
                </li>
              ))}
              {data.participants.length === 0 && <p className="text-[12.5px] text-muted">No interviewers assigned.</p>}
            </ul>
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Submitted scorecards</h2>
            <div className="mt-3 space-y-3">
              {data.scorecards.map((scorecard) => (
                <div key={scorecard.id} className="rounded-md border border-rule px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-medium text-ink">{scorecard.interviewer_name}</p>
                    <Badge tone={scorecard.overall.includes('yes') ? 'success' : 'danger'}>{STATUS_LABELS[scorecard.overall]}</Badge>
                  </div>
                  {scorecard.summary && <p className="mt-1 text-[12px] leading-relaxed text-graphite">{scorecard.summary}</p>}
                  {scorecard.responses && scorecard.responses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {scorecard.responses.map((response) => {
                        const item = items.find((i) => i.id === response.item_id);
                        return <span key={response.item_id} className="font-mono text-[10.5px] text-muted">{item?.competency || 'item'} {response.rating}/5</span>;
                      })}
                    </div>
                  )}
                </div>
              ))}
              {data.scorecards.length === 0 && <p className="text-[12.5px] text-muted">No scorecards submitted yet.</p>}
            </div>
          </section>

          {data.my_participation && (
            <div className="rounded-card border border-rule bg-[#f4f0e6] p-4">
              <p className="text-[12.5px] font-medium text-ink">Your packet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-graphite">
                You were added as {data.my_participation.role}. The candidate's resume and other interviewers' scorecards stay private to the hiring team.
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Reschedule interview"
        footer={<><Button variant="ghost" onClick={() => setRescheduleOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={reschedule}>Save new time</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts"><Input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} /></Field>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">Rescheduling does not send an email automatically. Prepare a reschedule message from the application or update the candidate directly.</p>
      </Modal>
    </>
  );
}
