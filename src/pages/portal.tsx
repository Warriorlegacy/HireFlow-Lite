import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Video,
  XCircle,
} from 'lucide-react';
import { api, download, errorMessage } from '../lib/api';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../components/ui';
import { formatDate, formatDateTime, STATUS_LABELS } from '../lib/format';

interface PortalInterview {
  title: string;
  format: string;
  start_at: number;
  end_at: number;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  candidate_notes: string | null;
  status: string;
}

interface PortalMessage {
  subject: string;
  body: string;
  status: string;
  created_at: number;
  sent_at: number | null;
}

interface PortalRequest {
  request_type: string;
  status: string;
  created_at: number;
  resolution_note: string | null;
}

interface PortalResponse {
  organization: {
    name: string;
    slug: string;
    privacy_notice_version: string;
    privacy_notice_url: string | null;
    retention_days: number;
  };
  application: {
    reference: string;
    candidate_name: string;
    candidate_email: string;
    job_title: string;
    job_location: string | null;
    work_mode: string;
    stage_name: string;
    stage_kind: string;
    status: string;
    applied_at: number;
    withdrawn_at: number | null;
  };
  timeline: { created_at: number; to_stage_name: string; to_stage_kind: string }[];
  interviews: PortalInterview[];
  messages: PortalMessage[];
  consent: { granted: number; notice_version: string; created_at: number; withdrawn_at: number | null } | null;
  deletion_requests: PortalRequest[];
}

export function PortalPage() {
  const { token = '' } = useParams();
  const { push } = useToast();
  const [data, setData] = useState<PortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState<'delete' | 'correct'>('delete');
  const [requestNote, setRequestNote] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [consentWithdrawn, setConsentWithdrawn] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<PortalResponse>(`/portal/${encodeURIComponent(token)}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  async function withdraw() {
    setBusy(true);
    try {
      await api(`/portal/${encodeURIComponent(token)}/withdraw`, { body: { reason: withdrawReason.trim() || 'Withdrawn by candidate' } });
      push('Your application has been withdrawn.');
      setWithdrawOpen(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function withdrawConsent() {
    setBusy(true);
    try {
      await api(`/portal/${encodeURIComponent(token)}/consent-withdraw`, { body: {} });
      setConsentWithdrawn(true);
      push('Consent withdrawn. The hiring team can see this.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(e?: React.FormEvent) {
    e?.preventDefault();
    if (requestNote.trim().length < 4) {
      push('Tell us what needs changing or deleting.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/portal/${encodeURIComponent(token)}/data-request`, {
        body: { request_type: requestType, note: requestNote.trim() },
      });
      setRequestSent(true);
      setRequestOpen(false);
      setRequestNote('');
      push('Your request has been recorded.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode, label = 'Candidate status') => (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule bg-surface/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-accent text-white"><span className="font-display text-[12px] leading-none">H</span></span>
            <span className="text-[12px] text-muted">{data?.organization.name || 'HireFlow'} · {label}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-rule px-1.5 py-0.5 font-mono text-[9.5px] text-muted">
            <Lock size={9} /> private link
          </span>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-3xl px-5 pb-10 pt-4">
        <p className="text-[10.5px] leading-relaxed text-muted">
          This page is private to you. Anyone with the link can see it, so do not forward it. Access is logged. The link expires on its own.
        </p>
      </footer>
    </div>
  );

  if (loading) {
    return shell(<div className="mx-auto max-w-3xl px-5 py-10"><LoadingBlock rows={5} /></div>);
  }
  if (error || !data) {
    return shell(
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-muted"><XCircle size={18} /></span>
        <h1 className="mt-4 font-display text-[28px] text-ink">This link has expired</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-graphite">
          {error || 'The status link is not valid. Ask the hiring team for a fresh link.'}
        </p>
      </div>,
    );
  }

  const app = data.application;
  const org = data.organization;
  const withdrawn = app.status === 'withdrawn';
  const closed = app.status === 'archived';
  const scheduled = data.interviews.filter((i) => i.status === 'scheduled');
  const canWithdraw = !withdrawn && !closed && app.stage_kind !== 'rejected' && app.stage_kind !== 'hired';

  return shell(
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Your application</p>
          <h1 className="mt-1.5 font-display text-[30px] leading-tight text-ink sm:text-[36px]">{app.job_title}</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {app.candidate_name} · {app.candidate_email}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-muted">{app.reference}</p>
          <p className="mt-1 font-mono text-[10.5px] text-muted">applied {formatDate(app.applied_at)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="stamp">{app.stage_name}</span>
        <Badge tone={app.status === 'hired' ? 'success' : app.status === 'rejected' ? 'danger' : app.status === 'withdrawn' ? 'neutral' : 'accent'}>
          {STATUS_LABELS[app.status] || app.status}
        </Badge>
        {withdrawn && app.withdrawn_at && <span className="text-[11.5px] text-muted">withdrawn {formatDate(app.withdrawn_at)}</span>}
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <section className="card card-pad">
          <h2 className="text-[12px] font-medium text-muted">The role</h2>
          <p className="mt-1.5 text-[13.5px] text-ink">{app.job_title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-graphite">
            <MapPin size={12} className="text-muted" />
            {app.job_location ? `${app.work_mode === 'remote' ? 'Remote' : app.work_mode === 'hybrid' ? 'Hybrid' : 'On-site'} · ${app.job_location}` : app.work_mode}
          </p>
        </section>
        <section className="card card-pad">
          <h2 className="text-[12px] font-medium text-muted">What you agreed to</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-graphite">
            <ShieldCheck size={13} className="text-accent" />
            Privacy notice {data.consent?.notice_version || org.privacy_notice_version}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            {data.consent?.withdrawn_at || consentWithdrawn
              ? `Consent withdrawn ${formatDate(data.consent?.withdrawn_at || Date.now())}.`
              : `Given ${formatDate(data.consent?.created_at || app.applied_at)}. Kept for ${org.retention_days} days, then anonymised.`}
          </p>
          {org.privacy_notice_url && (
            <a href={org.privacy_notice_url} className="mt-1.5 inline-block text-[11.5px] text-accent underline underline-offset-2">Read the notice</a>
          )}
        </section>
      </div>

      <section className="card mt-4">
        <div className="border-b border-rule px-5 py-3.5">
          <h2 className="text-[13px] font-medium text-ink">Progress</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">Every stage change is recorded by the hiring team.</p>
        </div>
        <ol className="px-5 py-4">
          {data.timeline.map((event, index) => (
            <li key={`${event.created_at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
              {index < data.timeline.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-rule" aria-hidden />}
              <span className="mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-accent bg-paper" aria-hidden />
              <div className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
                <p className="text-[12.5px] text-ink">{event.to_stage_name}</p>
                <p className="font-mono text-[10px] text-muted">{formatDate(event.created_at)}</p>
              </div>
            </li>
          ))}
          {data.timeline.length === 0 && <p className="text-[12.5px] text-muted">No stage events yet.</p>}
        </ol>
      </section>

      {scheduled.length > 0 && (
        <section className="card mt-4">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <div>
              <h2 className="text-[13px] font-medium text-ink">Interviews</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">Times are shown in the hiring team's timezone.</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<Download size={13} />}
              onClick={() => download(`/portal/${encodeURIComponent(token)}/calendar.ics`, 'interviews.ics').catch((err) => push(errorMessage(err), 'error'))}
            >
              Add to calendar
            </Button>
          </div>
          <ul className="divide-y divide-rule/70">
            {data.interviews.map((interview, index) => (
              <li key={`${interview.title}-${index}`} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium text-ink">{interview.title}</p>
                  <Badge tone={interview.status === 'scheduled' ? 'accent' : interview.status === 'completed' ? 'success' : 'neutral'}>
                    {STATUS_LABELS[interview.status] || interview.status}
                  </Badge>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-graphite">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} className="text-muted" /> {formatDateTime(interview.start_at, interview.timezone)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    {interview.format === 'video' ? <Video size={12} className="text-muted" /> : interview.format === 'phone' ? <Clock size={12} className="text-muted" /> : <MapPin size={12} className="text-muted" />}
                    {interview.format}
                  </span>
                </p>
                {interview.meeting_url && (
                  <a href={interview.meeting_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[12px] text-accent underline underline-offset-2">
                    Join meeting
                  </a>
                )}
                {interview.candidate_notes && (
                  <p className="mt-2 rounded-md border border-rule bg-paper/60 px-3 py-2 text-[12px] leading-relaxed text-graphite">{interview.candidate_notes}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-4">
        <div className="border-b border-rule px-5 py-3.5">
          <h2 className="text-[13px] font-medium text-ink">Messages from the hiring team</h2>
        </div>
        {data.messages.length === 0 ? (
          <EmptyState title="No messages yet" icon={<Mail size={18} />}>
            Messages sent to you appear here with their real delivery state.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule/70">
            {data.messages.map((message, index) => (
              <li key={`${message.subject}-${index}`} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12.5px] font-medium text-ink">{message.subject}</p>
                  <Badge tone={message.status === 'sent' ? 'success' : message.status === 'failed' ? 'danger' : 'warning'}>
                    {message.status === 'sent' ? 'Sent' : message.status === 'failed' ? 'Not delivered' : 'Not sent'}
                  </Badge>
                  <span className="ml-auto font-mono text-[10px] text-muted">{formatDate(message.created_at)}</span>
                </div>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11.5px] text-accent">Read message</summary>
                  <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-graphite">{message.body}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.deletion_requests.length > 0 && (
        <section className="card mt-4">
          <div className="border-b border-rule px-5 py-3.5">
            <h2 className="text-[13px] font-medium text-ink">Your data requests</h2>
          </div>
          <ul className="divide-y divide-rule/70">
            {data.deletion_requests.map((request, index) => (
              <li key={`${request.created_at}-${index}`} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <p className="text-[12.5px] text-graphite">{request.request_type === 'delete' ? 'Deletion request' : 'Correction request'}</p>
                <Badge tone={request.status === 'open' ? 'warning' : request.status === 'completed' ? 'success' : 'neutral'}>
                  {STATUS_LABELS[request.status] || request.status}
                </Badge>
                <span className="ml-auto font-mono text-[10px] text-muted">{formatDate(request.created_at)}</span>
                {request.resolution_note && <p className="w-full text-[11.5px] leading-relaxed text-muted">{request.resolution_note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-card border border-rule bg-[#f4f0e6] p-4">
        <h2 className="text-[12.5px] font-medium text-ink">Your choices</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-graphite">
          You can withdraw your application, withdraw consent for future processing, or ask for a correction or deletion. A person on the
          hiring team reviews requests. Deletion may be declined where a documented retention obligation applies.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canWithdraw && <Button size="sm" variant="danger" onClick={() => setWithdrawOpen(true)}>Withdraw application</Button>}
          {!data.consent?.withdrawn_at && !consentWithdrawn && (
            <Button size="sm" variant="ghost" loading={busy} onClick={withdrawConsent}>Withdraw consent</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setRequestOpen(true)}>Request correction or deletion</Button>
        </div>
        {requestSent && (
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-positive">
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> Your request is recorded. The hiring team will review it.
          </p>
        )}
      </section>

      <p className="mt-5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        This deployment has no email provider configured, so messages may be logged but not delivered. If something is urgent, contact the hiring team directly.
      </p>

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw this application?"
        description="The hiring team is told immediately and your application moves to Withdrawn. This cannot be undone by you."
        footer={
          <>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>Keep application</Button>
            <Button variant="danger" loading={busy} onClick={withdraw}>Withdraw</Button>
          </>
        }
      >
        <Field label="Reason" hint="Optional. Shared with the hiring team.">
          <Textarea rows={3} value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder="I have accepted another offer." />
        </Field>
      </Modal>

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a correction or deletion"
        description="This creates a reviewable request. It does not delete the record automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={sendRequest}>Send request</Button>
          </>
        }
      >
        <form onSubmit={sendRequest} className="space-y-4">
          <Field label="What do you need?">
            <Select value={requestType} onChange={(e) => setRequestType(e.target.value as 'delete' | 'correct')}>
              <option value="delete">Delete my data</option>
              <option value="correct">Correct my data</option>
            </Select>
          </Field>
          <Field label="Details" required hint="Be specific so the hiring team can act without guessing.">
            <Textarea rows={4} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Please correct my location to Pune, or delete the application and resume." required minLength={4} />
          </Field>
          <input type="text" value={app.candidate_email} readOnly hidden aria-hidden />
          <Input type="text" value={app.reference} readOnly hidden aria-hidden />
        </form>
      </Modal>
    </main>,
  );
}
