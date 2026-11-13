import { useEffect, useState } from 'react';
import { CheckCircle2, FileWarning, ShieldCheck, XCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Textarea,
  useToast,
} from '../components/ui';
import { formatDate, formatDateTime } from '../lib/format';
import type { DeletionRequest } from '../types';

interface PrivacyRow extends DeletionRequest {
  application_status: string;
  anonymized_at: number | null;
}

export function PrivacyPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<PrivacyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'completed' | 'rejected'>('open');
  const [target, setTarget] = useState<PrivacyRow | null>(null);
  const [action, setAction] = useState<'anonymise' | 'reject'>('anonymise');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ requests: PrivacyRow[] }>('/privacy/requests');
      setRows(data.requests);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  function open(row: PrivacyRow, nextAction: 'anonymise' | 'reject') {
    setTarget(row);
    setAction(nextAction);
    setNote('');
  }

  async function resolve() {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/privacy/requests/${target.id}/resolve`, { method: 'POST', body: { action, note: note.trim() || null } });
      push(action === 'anonymise' ? 'Application anonymised and the request is complete.' : 'Request reviewed and declined.');
      setTarget(null);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><PageHeader title="Privacy requests" /><LoadingBlock rows={5} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  const openCount = rows.filter((row) => row.status === 'open').length;

  return (
    <>
      <PageHeader
        title="Privacy requests"
        description="Candidate requests to delete or correct data. Candidates submit these from their private status link; the decision is recorded with a note."
        actions={<Badge tone={openCount ? 'warning' : 'neutral'}>{openCount} open</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {([['open', 'Open'], ['completed', 'Completed'], ['rejected', 'Declined'], ['all', 'All']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-2.5 py-1.5 text-[12.5px] ${filter === key ? 'bg-accentSoft font-medium text-accentDark' : 'text-graphite hover:bg-subtle'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState title={filter === 'open' ? 'No open requests' : 'Nothing in this view'} icon={<ShieldCheck size={18} />}>
            Candidates can ask for deletion, correction or withdraw consent from their private status link.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <article key={row.id} className="card">
              <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${row.status === 'open' ? 'bg-warningSoft text-warning' : row.status === 'completed' ? 'bg-positiveSoft text-positive' : 'bg-subtle text-muted'}`}>
                  {row.status === 'open' ? <FileWarning size={15} /> : row.status === 'completed' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[14px] font-medium text-ink">{row.candidate_name}</h2>
                    <Badge tone={row.request_type === 'delete' ? 'danger' : 'neutral'}>{row.request_type === 'delete' ? 'Deletion' : 'Correction'}</Badge>
                    <Badge tone={row.status === 'open' ? 'warning' : row.status === 'completed' ? 'success' : 'neutral'}>
                      {row.status === 'open' ? 'Open' : row.status === 'completed' ? 'Completed' : 'Declined'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {row.candidate_email} · {row.job_title} · application status {row.application_status}
                    {row.anonymized_at ? ' · already anonymised' : ''}
                  </p>
                  <p className="mt-2 rounded-md border border-rule bg-paper/60 px-3 py-2 text-[12.5px] leading-relaxed text-graphite">
                    {row.note}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">
                    Requested {formatDateTime(row.created_at)} by {row.requested_by}
                    {row.resolved_at ? ` · resolved ${formatDate(row.resolved_at)}` : ''}
                  </p>
                  {row.resolution_note && <p className="mt-1 text-[11.5px] text-graphite">Resolution: {row.resolution_note}</p>}
                </div>
                {row.status === 'open' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="danger" onClick={() => open(row, 'anonymise')}>Anonymise</Button>
                    <Button size="sm" variant="ghost" onClick={() => open(row, 'reject')}>Decline</Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="mt-5 rounded-card border border-rule bg-[#f4f0e6] p-4">
        <p className="text-[12.5px] font-medium text-ink">Before you anonymise</p>
        <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-graphite">
          <li>Anonymisation removes the candidate's identity, contact details, answers, resume object and message bodies. It cannot be undone.</li>
          <li>Stage history and audit entries stay, because they are needed to show how the decision was made and who made it.</li>
          <li>Declining a request is legitimate only where a documented retention or legal obligation applies. Write the reason in the note.</li>
        </ul>
      </section>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={action === 'anonymise' ? `Anonymise ${target?.candidate_name}?` : 'Decline this request?'}
        description={
          action === 'anonymise'
            ? 'This permanently removes identifying data and the resume. Stage history and audit entries remain.'
            : 'The candidate keeps their record. Record the policy reason for declining.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant={action === 'anonymise' ? 'danger' : 'primary'} loading={busy} onClick={resolve}>
              {action === 'anonymise' ? 'Anonymise record' : 'Decline request'}
            </Button>
          </>
        }
      >
        <Field label="Resolution note" hint={action === 'anonymise' ? 'Optional context for the audit trail.' : 'Required context: cite the retention rule or obligation.'}>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={action === 'anonymise' ? 'Candidate asked us to delete their application data.' : 'Statutory retention period requires us to keep this record until…'} />
        </Field>
      </Modal>
    </>
  );
}
