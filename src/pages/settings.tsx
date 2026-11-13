import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Database,
  HardDrive,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import {
  Badge,
  Button,
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
import { formatDate, formatDateTime } from '../lib/format';
import type { Organization, Stage } from '../types';

interface RetentionRule {
  id: string;
  category: string;
  retention_days: number;
  updated_at: number;
}

interface SettingsData {
  organization: Organization;
  stages: Stage[];
  retention: RetentionRule[];
  usage: {
    active_jobs: number;
    team_seats: number;
    monthly_applications: number;
    guidance: { active_jobs: number; team_seats: number; monthly_applications: number };
    note: string;
  };
  integrations: {
    email: { configured: boolean; provider: string | null; from: string | null };
    ai: { enabled: boolean; available: boolean; provider: string | null; note: string };
    storage: { backend: 'r2' | 'd1'; note: string };
  };
  can_manage: boolean;
}

interface StageDraft {
  id?: string;
  key?: string;
  name: string;
  kind: Stage['kind'];
}

const KIND_LABELS: Record<string, string> = {
  active: 'Active pipeline',
  offer: 'Offer',
  hired: 'Hired (closes)',
  rejected: 'Rejected (closes)',
  withdrawn: 'Withdrawn (closes)',
};

export function SettingsPage() {
  const { push } = useToast();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    website: '',
    careers_intro: '',
    privacy_notice_version: '',
    privacy_notice_url: '',
    default_retention_days: 365,
    email_from: '',
  });
  const [savingOrg, setSavingOrg] = useState(false);
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [savingStages, setSavingStages] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [savingRetention, setSavingRetention] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ retention_days: number; cutoff: number; would_anonymise: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api<SettingsData>('/settings');
      setData(detail);
      const org = detail.organization;
      setForm({
        name: org.name,
        website: org.website || '',
        careers_intro: org.careers_intro || '',
        privacy_notice_version: org.privacy_notice_version || '',
        privacy_notice_url: org.privacy_notice_url || '',
        default_retention_days: org.default_retention_days || 365,
        email_from: org.email_from || '',
      });
      setStages(detail.stages.map((s) => ({ id: s.id, key: s.key, name: s.name, kind: s.kind })));
      const appRule = detail.retention.find((r) => r.category === 'applications');
      setRetentionDays(appRule?.retention_days || org.default_retention_days || 365);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <><PageHeader title="Settings" /><LoadingBlock rows={6} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return null;
  const canManage = data.can_manage;

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrg(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: {
          name: form.name,
          website: form.website || null,
          careers_intro: form.careers_intro || null,
          privacy_notice_version: form.privacy_notice_version,
          privacy_notice_url: form.privacy_notice_url || null,
          default_retention_days: Number(form.default_retention_days),
          email_from: form.email_from || null,
        },
      });
      push('Workspace settings saved.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setSavingOrg(false);
    }
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages((list) => {
      const next = [...list];
      const target = index + direction;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveStages() {
    if (stages.some((s) => !s.name.trim())) {
      push('Every stage needs a name.', 'error');
      return;
    }
    setSavingStages(true);
    try {
      await api('/settings/stages', {
        method: 'PUT',
        body: { stages: stages.map((s) => ({ id: s.id, name: s.name.trim(), kind: s.kind })) },
      });
      push('Pipeline stages saved.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setSavingStages(false);
    }
  }

  async function saveRetention() {
    setSavingRetention(true);
    try {
      await api('/settings/retention', { method: 'PUT', body: { applications_days: Number(retentionDays) } });
      push('Retention policy saved.');
      setPreviewResult(null);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setSavingRetention(false);
    }
  }

  async function previewRetention() {
    setPreviewing(true);
    try {
      setPreviewResult(await api('/settings/retention/preview', { method: 'POST' }));
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setPreviewing(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const result = await api<{ applications: number; resumesDeleted: number }>('/settings/retention/run', {
        method: 'POST',
        body: { confirm: true },
      });
      push(`${result.applications} applications anonymised, ${result.resumesDeleted} resume files deleted.`);
      setRunOpen(false);
      setPreviewResult(null);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setRunning(false);
    }
  }

  async function toggleAi() {
    setTogglingAi(true);
    const enabled = data?.integrations.ai.enabled ?? false;
    try {
      await api('/settings', { method: 'PATCH', body: { ai_enabled: !enabled } });
      push(enabled ? 'AI assistance turned off.' : 'AI assistance turned on.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setTogglingAi(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace identity, pipeline shape, retention and integration status. Only owners and admins can change these."
        actions={!canManage ? <Badge>Read only</Badge> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[19px] text-ink">Workspace</h2>
            <p className="mt-1 text-[12.5px] text-muted">Shown on public careers pages and in candidate emails.</p>
            <form onSubmit={saveOrg} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Workspace name" required>
                  <Input value={form.name} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </Field>
                <Field label="Website">
                  <Input value={form.website} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
                </Field>
              </div>
              <Field label="Careers page introduction" hint="A short, honest paragraph at the top of the public careers page.">
                <Textarea rows={4} value={form.careers_intro} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, careers_intro: e.target.value }))} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Privacy notice version" hint="Recorded against each new consent.">
                  <Input value={form.privacy_notice_version} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, privacy_notice_version: e.target.value }))} />
                </Field>
                <Field label="Privacy notice URL">
                  <Input value={form.privacy_notice_url} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, privacy_notice_url: e.target.value }))} placeholder="/privacy" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default retention" hint="Days after application before anonymisation becomes due.">
                  <Input
                    type="number"
                    min={30}
                    max={3650}
                    value={form.default_retention_days}
                    disabled={!canManage}
                    onChange={(e) => setForm((f) => ({ ...f, default_retention_days: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Reply-from address" hint="Used when an email provider is configured.">
                  <Input value={form.email_from} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, email_from: e.target.value }))} placeholder="hiring@example.com" />
                </Field>
              </div>
              {canManage && (
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" loading={savingOrg}>Save workspace</Button>
                </div>
              )}
            </form>
          </section>

          <section className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] text-ink">Pipeline stages</h2>
                <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-muted">
                  Used by every role. New, Rejected and Withdrawn are required. A stage that still holds applications cannot be removed.
                </p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => setStages((list) => [...list.slice(0, Math.max(1, list.length - 3)), { name: '', kind: 'active' }, ...list.slice(Math.max(1, list.length - 3))])}
                >
                  Add stage
                </Button>
              )}
            </div>

            <ol className="mt-4 space-y-2">
              {stages.map((stage, index) => {
                const required = ['new', 'rejected', 'withdrawn'].includes(stage.key || '');
                return (
                  <li key={stage.id || `new-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border border-rule bg-paper/40 px-2.5 py-2">
                    <span className="w-5 font-mono text-[11px] text-muted">{String(index + 1).padStart(2, '0')}</span>
                    <Input
                      value={stage.name}
                      disabled={!canManage}
                      aria-label={`Stage ${index + 1} name`}
                      onChange={(e) => setStages((list) => list.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)))}
                      className="h-8 min-w-[140px] flex-1 py-0 text-[12.5px]"
                    />
                    <Select
                      value={stage.kind}
                      disabled={!canManage || required}
                      aria-label={`Stage ${index + 1} kind`}
                      onChange={(e) => setStages((list) => list.map((s, i) => (i === index ? { ...s, kind: e.target.value as Stage['kind'] } : s)))}
                      className="h-8 w-auto py-0 text-[12px]"
                    >
                      {Object.entries(KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
                    </Select>
                    {canManage && (
                      <div className="ml-auto flex items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 text-muted hover:bg-subtle hover:text-ink disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveStage(index, -1)}
                          aria-label={`Move ${stage.name} up`}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted hover:bg-subtle hover:text-ink disabled:opacity-30"
                          disabled={index === stages.length - 1}
                          onClick={() => moveStage(index, 1)}
                          aria-label={`Move ${stage.name} down`}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted hover:bg-negativeSoft hover:text-negative disabled:opacity-30"
                          disabled={required}
                          onClick={() => setStages((list) => list.filter((_, i) => i !== index))}
                          aria-label={`Remove ${stage.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {canManage && (
              <div className="mt-4 flex justify-end">
                <Button variant="primary" loading={savingStages} onClick={saveStages}>Save pipeline</Button>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Data retention</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              After the window, a record is anonymised: name, contact details, answers, resume and message bodies are removed. Stage history stays for auditability.
            </p>
            <div className="mt-4">
              <Field label="Keep applications for" hint="Between 30 and 3650 days.">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={30}
                    max={3650}
                    value={retentionDays}
                    disabled={!canManage}
                    onChange={(e) => { setRetentionDays(Number(e.target.value)); setPreviewResult(null); }}
                    className="max-w-[120px]"
                  />
                  <span className="text-[13px] text-graphite">days</span>
                  {canManage && <Button size="sm" loading={savingRetention} onClick={saveRetention}>Save</Button>}
                </div>
              </Field>
            </div>

            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-3">
                <Button size="sm" loading={previewing} onClick={previewRetention}>Preview now</Button>
                <Button size="sm" variant="ghost" onClick={() => { setPreviewResult(null); setRunOpen(true); }}>Run retention</Button>
              </div>
            )}

            {previewResult && (
              <div className="mt-3 rounded-md border border-rule bg-paper/60 px-3 py-2.5 text-[12px] leading-relaxed text-graphite">
                At {previewResult.retention_days} days, {previewResult.would_anonymise} application{previewResult.would_anonymise === 1 ? '' : 's'} would be anonymised now.
                <br />
                <span className="text-[11px] text-muted">Cutoff {formatDateTime(previewResult.cutoff)}</span>
              </div>
            )}

            <div className="mt-4 space-y-1.5">
              {data.retention.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between text-[11.5px]">
                  <span className="capitalize text-muted">{rule.category}</span>
                  <span className="font-mono text-graphite">{rule.retention_days}d</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Integrations</h2>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${data.integrations.email.configured ? 'bg-positiveSoft text-positive' : 'bg-subtle text-muted'}`}>
                  <ShieldCheck size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">Email delivery</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    {data.integrations.email.configured
                      ? `Configured via ${data.integrations.email.provider}${data.integrations.email.from ? ` from ${data.integrations.email.from}` : ''}.`
                      : 'Not configured. Messages are saved to the log and marked not sent.'}
                  </p>
                </div>
                <Badge tone={data.integrations.email.configured ? 'success' : 'warning'}>{data.integrations.email.configured ? 'Live' : 'Off'}</Badge>
              </li>
              <li className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${data.integrations.storage.backend === 'r2' ? 'bg-positiveSoft text-positive' : 'bg-subtle text-muted'}`}>
                  {data.integrations.storage.backend === 'r2' ? <Database size={14} /> : <HardDrive size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">Resume storage</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{data.integrations.storage.note}</p>
                </div>
                <Badge>{data.integrations.storage.backend.toUpperCase()}</Badge>
              </li>
              <li className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${data.integrations.ai.enabled ? 'bg-accentSoft text-accent' : 'bg-subtle text-muted'}`}>
                  <Sparkles size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">AI assistance</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    {data.integrations.ai.note}
                    {!data.integrations.ai.available && ' No provider is configured, so it cannot be enabled.'}
                  </p>
                  {canManage && data.integrations.ai.available && (
                    <Button size="sm" className="mt-2" loading={togglingAi} onClick={toggleAi}>
                      {data.integrations.ai.enabled ? 'Turn off' : 'Turn on'}
                    </Button>
                  )}
                </div>
                <Badge tone={data.integrations.ai.enabled ? 'accent' : 'neutral'}>{data.integrations.ai.enabled ? 'On' : 'Off'}</Badge>
              </li>
            </ul>
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Pilot usage</h2>
            <p className="mt-1 text-[11.5px] text-muted">{data.usage.note}</p>
            <div className="mt-3 space-y-2.5">
              {[
                { label: 'Published roles', value: data.usage.active_jobs, max: data.usage.guidance.active_jobs },
                { label: 'Active seats', value: data.usage.team_seats, max: data.usage.guidance.team_seats },
                { label: 'Applications, 30 days', value: data.usage.monthly_applications, max: data.usage.guidance.monthly_applications },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-graphite">{row.label}</span>
                    <span className="font-mono text-[11px] text-muted">{row.value} / {row.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                    <div
                      className={`h-full rounded-full ${row.value > row.max ? 'bg-warning' : 'bg-accent/70'}`}
                      style={{ width: `${Math.min(100, (row.value / Math.max(1, row.max)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="text-[11.5px] leading-relaxed text-muted">
            Workspace created {formatDate(data.organization.created_at)}. Environment values live in <span className="font-mono text-[11px]">wrangler.jsonc</span> and secrets, not in this page.
          </p>
        </div>
      </div>

      <Modal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Run retention now?"
        description="This anonymises every application past its retention window. It cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={running} onClick={runNow}>Anonymise now</Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-md border border-warning/25 bg-warningSoft/60 px-3 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[12.5px] leading-relaxed text-graphite">
            Preview first. The scheduled Worker also runs retention daily, so this manual run is for a specific request or a policy change.
          </p>
        </div>
      </Modal>
    </>
  );
}
