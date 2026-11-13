import { useEffect, useState } from 'react';
import { ClipboardList, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  useToast,
} from '../components/ui';
import { formatDateTime, timeAgo } from '../lib/format';

interface AuditEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  user_name: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: number;
  prev_hash: string | null;
  hash: string | null;
}

interface AuditData {
  events: AuditEvent[];
  actions: string[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export function AuditPage() {
  const { push } = useToast();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '40' });
      if (action) params.set('action', action);
      setData(await api<AuditData>(`/audit?${params.toString()}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, action]);

  if (loading && !data) return <><PageHeader title="Audit log" /><LoadingBlock rows={7} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of sensitive actions. Each entry carries a hash chain so tampering with earlier rows can be detected."
        actions={<Badge>{data.pagination.total} events</Badge>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by action">
          <option value="">All actions</option>
          {data.actions.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
        <p className="text-[11.5px] text-muted">
          {data.pagination.page} of {data.pagination.pages} pages · newest first
        </p>
      </div>

      {data.events.length === 0 ? (
        <div className="card">
          <EmptyState title="No audit events yet" icon={<ClipboardList size={18} />}>
            Actions such as stage changes, exports, invitations and retention runs appear here.
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base min-w-[780px]">
              <thead>
                <tr>
                  <th className="pl-5">When</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Person</th>
                  <th>IP</th>
                  <th className="pr-5">Hash</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.id} className="cursor-pointer hover:bg-paper/50" onClick={() => setExpanded(expanded === event.id ? null : event.id)}>
                    <td className="pl-5">
                      <p className="text-[12px] text-ink">{formatDateTime(event.created_at)}</p>
                      <p className="text-[10.5px] text-muted">{timeAgo(event.created_at)}</p>
                    </td>
                    <td>
                      <span className="font-mono text-[11.5px] text-graphite">{event.action}</span>
                      {expanded === event.id && Object.keys(event.metadata || {}).length > 0 && (
                        <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap rounded border border-rule bg-paper/70 p-2 font-mono text-[10.5px] leading-relaxed text-graphite">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td className="text-[11.5px] text-muted">
                      {event.entity_type}
                      <span className="ml-1 font-mono text-[10.5px]">…{String(event.entity_id).slice(-8)}</span>
                    </td>
                    <td className="text-[12px] text-graphite">{event.user_name || 'System'}</td>
                    <td className="font-mono text-[10.5px] text-muted">{event.ip || '—'}</td>
                    <td className="pr-5 font-mono text-[10.5px] text-muted">{event.hash ? `…${event.hash.slice(-10)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-rule px-5 py-2.5">
            <Button
              size="sm"
              variant="ghost"
              icon={<ChevronLeft size={13} />}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <p className="font-mono text-[11px] text-muted">page {data.pagination.page} / {data.pagination.pages}</p>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= data.pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}

      <section className="mt-5 rounded-card border border-rule bg-[#f4f0e6] p-4">
        <p className="text-[12.5px] font-medium text-ink">What is recorded</p>
        <p className="mt-1 text-[12px] leading-relaxed text-graphite">
          Authentication, team and settings changes, stage moves, candidate data exports and imports, message sends, portal issuance, retention runs and candidate data requests.
          Resumes and message bodies are not copied into the audit log. Click a row to see its structured metadata.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Search size={11} /> Filter by action prefix. IP addresses come from the connecting request.
        </p>
      </section>
    </>
  );
}
