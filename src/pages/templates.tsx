import { useEffect, useMemo, useState } from 'react';
import { BellOff, MessageSquare, Save, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Textarea,
  useToast,
} from '../components/ui';
import { formatDate } from '../lib/format';
import type { Template } from '../types';

const VARIABLES = [
  { key: '{{candidate_name}}', label: 'Candidate name' },
  { key: '{{job_title}}', label: 'Role title' },
  { key: '{{company_name}}', label: 'Workspace name' },
  { key: '{{stage_name}}', label: 'Current stage' },
  { key: '{{status_message}}', label: 'Status message' },
  { key: '{{interview_title}}', label: 'Interview title' },
  { key: '{{interview_time}}', label: 'Interview time' },
  { key: '{{interview_format}}', label: 'Interview format' },
  { key: '{{retention_days}}', label: 'Retention days' },
];

const SAMPLE: Record<string, string> = {
  candidate_name: 'Maya Krishnan',
  job_title: 'Senior Product Designer',
  company_name: 'Fieldnote Labs',
  stage_name: 'Interview',
  status_message: 'Your application is currently in the Interview stage.',
  interview_title: 'Craft interview',
  interview_time: '18 Nov 2026, 3:00 pm',
  interview_format: 'video',
  retention_days: '365',
};

function render(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE[key] ?? '');
}

export function TemplatesPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKey, setActiveKey] = useState('');
  const [draft, setDraft] = useState({ name: '', subject: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ templates: Template[]; can_edit: boolean; email_configured: boolean }>('/communications/templates');
      setTemplates(data.templates);
      setCanEdit(data.can_edit);
      setEmailConfigured(data.email_configured);
      const first = data.templates[0];
      if (first && !activeKey) {
        setActiveKey(first.key);
        setDraft({ name: first.name, subject: first.subject, body: first.body });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = useMemo(() => templates.find((t) => t.key === activeKey), [templates, activeKey]);

  function selectTemplate(template: Template) {
    if (dirty && !window.confirm('Discard unsaved changes to this template?')) return;
    setActiveKey(template.key);
    setDraft({ name: template.name, subject: template.subject, body: template.body });
    setDirty(false);
  }

  function insertVariable(value: string) {
    setDraft((d) => ({ ...d, body: `${d.body}${d.body.endsWith(' ') || !d.body ? '' : ' '}${value}` }));
    setDirty(true);
  }

  async function save() {
    if (!active) return;
    if (draft.name.trim().length < 2 || draft.subject.trim().length < 2 || draft.body.trim().length < 10) {
      push('Give the template a name, subject and body before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api(`/communications/templates/${encodeURIComponent(active.key)}`, { method: 'PUT', body: draft });
      push('Template saved.');
      setDirty(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><PageHeader title="Messages" /><LoadingBlock rows={5} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Messages"
        description="Reusable email templates for the messages the hiring team sends from an application. Variables are filled from the live record at send time."
        actions={canEdit ? <Button variant="primary" icon={<Save size={14} />} loading={saving} onClick={save} disabled={!active || !dirty}>Save template</Button> : undefined}
      />

      <div className={`mb-5 flex items-start gap-2.5 rounded-card border px-4 py-3 ${emailConfigured ? 'border-positive/20 bg-positiveSoft/60' : 'border-warning/25 bg-warningSoft/70'}`}>
        {emailConfigured ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-positive" /> : <BellOff size={16} className="mt-0.5 shrink-0 text-warning" />}
        <div>
          <p className={`text-[13px] font-medium ${emailConfigured ? 'text-positive' : 'text-warning'}`}>
            {emailConfigured ? 'Email delivery is configured' : 'Email delivery is not configured'}
          </p>
          <p className={`mt-0.5 text-[12.5px] leading-relaxed ${emailConfigured ? 'text-graphite' : 'text-warning'}`}>
            {emailConfigured
              ? 'Sending records the provider response. A message is only marked sent when the provider accepts it.'
              : 'Messages can be prepared and saved to the application log. They will be clearly marked as not sent, and nobody should tell a candidate otherwise.'}
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card">
          <EmptyState title="No templates yet" icon={<MessageSquare size={18} />}>
            Templates keep routine replies consistent. Add one through the API seed or create a workspace one.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <nav className="card h-fit overflow-hidden" aria-label="Message templates">
            <ul className="divide-y divide-rule/70">
              {templates.map((template) => (
                <li key={template.key}>
                  <button
                    onClick={() => selectTemplate(template)}
                    className={`block w-full px-4 py-3 text-left transition-colors ${template.key === activeKey ? 'bg-accentSoft/70' : 'hover:bg-subtle/60'}`}
                    aria-current={template.key === activeKey}
                  >
                    <span className={`block text-[13px] ${template.key === activeKey ? 'font-medium text-accentDark' : 'text-ink'}`}>{template.name}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted">{template.key}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {active && (
            <div className="space-y-5">
              <section className="card card-pad">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-[19px] text-ink">{active.name}</h2>
                    <p className="mt-0.5 text-[11.5px] text-muted">Last saved {formatDate(active.updated_at)} · {session?.org?.name}</p>
                  </div>
                  {!canEdit && <Badge>Read only</Badge>}
                </div>

                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Template name">
                      <Input value={draft.name} disabled={!canEdit} onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setDirty(true); }} />
                    </Field>
                    <Field label="Subject">
                      <Input value={draft.subject} disabled={!canEdit} onChange={(e) => { setDraft((d) => ({ ...d, subject: e.target.value })); setDirty(true); }} />
                    </Field>
                  </div>
                  <Field label="Body" hint="Plain text. Line breaks are kept.">
                    <Textarea rows={14} value={draft.body} disabled={!canEdit} onChange={(e) => { setDraft((d) => ({ ...d, body: e.target.value })); setDirty(true); }} />
                  </Field>
                  {canEdit && (
                    <div>
                      <p className="text-[12px] font-medium text-graphite">Insert a variable</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {VARIABLES.map((variable) => (
                          <button
                            key={variable.key}
                            type="button"
                            onClick={() => insertVariable(variable.key)}
                            className="rounded-[4px] border border-rule bg-paper px-1.5 py-1 font-mono text-[10.5px] text-graphite hover:border-accent/40 hover:text-accentDark"
                            title={variable.label}
                          >
                            {variable.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="card card-pad">
                <h2 className="font-display text-[17px] text-ink">Preview with sample data</h2>
                <p className="mt-1 text-[11.5px] text-muted">Synthetic values. The real message fills from the candidate's own record.</p>
                <div className="mt-3 rounded-md border border-rule bg-paper/60 px-4 py-3">
                  <p className="text-[12px] text-muted">Subject</p>
                  <p className="mt-0.5 text-[14px] font-medium text-ink">{render(draft.subject) || '—'}</p>
                  <div className="mt-3 border-t border-rule pt-3">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-graphite">{render(draft.body) || '—'}</p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
