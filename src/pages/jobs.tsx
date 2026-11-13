import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ClipboardCheck,
  ExternalLink,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
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
import { formatDate, salary, STATUS_LABELS, workMode } from '../lib/format';
import type { FormField, Job, ScorecardItem, Stage } from '../types';

interface JobCounts {
  total_applications: number;
  active_applications: number;
  new_applications: number;
  upcoming_interviews: number;
}

export function JobsPage() {
  const { session } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('current');
  const role = session?.membership?.role;
  const canCreate = role === 'owner' || role === 'admin' || role === 'recruiter';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ jobs: Job[] }>('/jobs');
      setJobs(data.jobs);
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
    if (filter === 'all') return jobs;
    if (filter === 'current') return jobs.filter((j) => j.status === 'published' || j.status === 'draft');
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  return (
    <>
      <PageHeader
        title="Roles"
        description="Each role carries its own hiring team, pipeline, scorecard and public careers page."
        actions={canCreate ? <Link to="/jobs/new"><Button variant="primary" icon={<Plus size={15} />}>New role</Button></Link> : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter roles">
        {[
          { key: 'current', label: 'Current' },
          { key: 'published', label: 'Published' },
          { key: 'draft', label: 'Drafts' },
          { key: 'closed', label: 'Closed' },
          { key: 'archived', label: 'Archived' },
          { key: 'all', label: 'All' },
        ].map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors ${
              filter === tab.key ? 'border-accent/30 bg-accentSoft text-accentDark' : 'border-transparent text-graphite hover:bg-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock rows={5} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title={filter === 'current' ? 'No current roles' : 'No roles match this view'}
            icon={<Briefcase size={18} />}
            action={canCreate ? <Link to="/jobs/new"><Button variant="primary" size="sm">Create the first role</Button></Link> : undefined}
          >
            A role holds the job description, application questions, hiring team and pipeline. Drafts stay private until published.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((job) => (
            <li key={job.id} className="card transition-colors hover:border-accent/30">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/jobs/${job.id}`} className="font-display text-[19px] leading-tight text-ink hover:underline">
                      {job.title}
                    </Link>
                    <Badge tone={job.status === 'published' ? 'success' : job.status === 'draft' ? 'warning' : 'neutral'}>
                      {STATUS_LABELS[job.status]}
                    </Badge>
                    {job.new_applications ? <Badge tone="accent">{job.new_applications} new</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {[job.department, job.location ? `${workMode(job.work_mode)} · ${job.location}` : workMode(job.work_mode), salary(job)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-[12.5px]">
                  <div>
                    <p className="font-display text-[20px] leading-none text-ink">{job.active_applications ?? 0}</p>
                    <p className="mt-1 text-[11px] text-muted">active</p>
                  </div>
                  <div>
                    <p className="font-display text-[20px] leading-none text-ink">{job.total_applications ?? 0}</p>
                    <p className="mt-1 text-[11px] text-muted">total</p>
                  </div>
                  <div>
                    <p className="font-display text-[20px] leading-none text-ink">{job.upcoming_interviews ?? 0}</p>
                    <p className="mt-1 text-[11px] text-muted">upcoming</p>
                  </div>
                  <Link to={`/jobs/${job.id}/pipeline`} className="ml-1 hidden items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-[12.5px] text-graphite hover:bg-subtle sm:inline-flex">
                    Pipeline <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule/70 px-4 py-2.5 text-[11.5px] text-muted sm:px-5">
                <span>Owner: {job.hiring_owner_name || 'Unassigned'}</span>
                {job.application_deadline && <span>Deadline: {formatDate(new Date(job.application_deadline).getTime())}</span>}
                {job.status === 'published' && (
                  <a href={`/careers/${job.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Public page <ExternalLink size={11} />
                  </a>
                )}
                <Link to={`/jobs/${job.id}`} className="ml-auto inline-flex items-center gap-1 text-graphite hover:text-ink sm:hidden">
                  Open <ArrowRight size={12} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Job editor                                                                 */
/* -------------------------------------------------------------------------- */
const EMPTY_FORM = {
  title: '',
  department: '',
  location: '',
  work_mode: 'hybrid',
  employment_type: 'full_time',
  salary_min: '',
  salary_max: '',
  salary_currency: 'INR',
  description: '',
  responsibilities: '',
  qualifications: '',
  application_deadline: '',
  hiring_owner_id: '',
  privacy_notice_version: '2026-11-01',
};

export function JobEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [fields, setFields] = useState<FormField[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const meta = await api<{ members: { id: string; full_name: string }[] }>('/jobs/meta/members');
        setMembers(meta.members);
        if (mode === 'edit' && id) {
          const data = await api<{ job: Job; access: string }>(`/jobs/${id}`);
          if (data.access !== 'manage' && data.access !== 'edit') {
            setError('You cannot edit this role.');
            return;
          }
          const j = data.job;
          setForm({
            title: j.title,
            department: j.department || '',
            location: j.location || '',
            work_mode: j.work_mode,
            employment_type: j.employment_type,
            salary_min: j.salary_min ? String(j.salary_min) : '',
            salary_max: j.salary_max ? String(j.salary_max) : '',
            salary_currency: j.salary_currency || 'INR',
            description: j.description,
            responsibilities: j.responsibilities || '',
            qualifications: j.qualifications || '',
            application_deadline: j.application_deadline || '',
            hiring_owner_id: j.hiring_owner_id || '',
            privacy_notice_version: j.privacy_notice_version || '2026-11-01',
          });
          setFields(j.application_fields || []);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, mode]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addField() {
    setFields((f) => [...f, { key: '', label: '', type: 'text', required: false }]);
  }

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((f) =>
      f.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.label !== undefined && (!item.key || item.key === slug(item.label))) {
          next.key = slug(patch.label);
        }
        return next;
      }),
    );
  }

  function slug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldError('');
    if (form.description.trim().length < 20) {
      setFieldError('Write at least a short paragraph describing the role.');
      return;
    }
    if (fields.some((f) => !f.key || !f.label)) {
      setFieldError('Every application question needs a label.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      department: form.department || null,
      location: form.location || null,
      salary_min: form.salary_min === '' ? null : Number(form.salary_min),
      salary_max: form.salary_max === '' ? null : Number(form.salary_max),
      application_deadline: form.application_deadline || null,
      hiring_owner_id: form.hiring_owner_id || null,
      responsibilities: form.responsibilities || null,
      qualifications: form.qualifications || null,
      application_fields: fields,
    };
    try {
      if (mode === 'new') {
        const data = await api<{ job: Job }>('/jobs', { body: payload });
        push('Draft created. Publish it when the description is ready.');
        navigate(`/jobs/${data.job.id}`);
      } else {
        await api(`/jobs/${id}`, { method: 'PATCH', body: payload });
        push('Role updated.');
        navigate(`/jobs/${id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock rows={8} />;

  return (
    <>
      <PageHeader
        title={mode === 'new' ? 'New role' : 'Edit role'}
        back={<Link to={mode === 'edit' && id ? `/jobs/${id}` : '/jobs'} className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft size={13} /> Roles</Link>}
        description={mode === 'new' ? 'The role is saved as a draft. Nothing is public until you publish it.' : 'Changes apply to the public page immediately once the role is published.'}
      />

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[19px] text-ink">The role</h2>
            <div className="mt-4 space-y-4">
              <Field label="Title" htmlFor="title" required>
                <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} required minLength={2} placeholder="Senior Product Designer" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" htmlFor="department">
                  <Input id="department" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Design" />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Bengaluru" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Work mode" htmlFor="work_mode">
                  <Select id="work_mode" value={form.work_mode} onChange={(e) => set('work_mode', e.target.value)}>
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </Select>
                </Field>
                <Field label="Employment type" htmlFor="employment_type">
                  <Select id="employment_type" value={form.employment_type} onChange={(e) => set('employment_type', e.target.value)}>
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Salary minimum" htmlFor="salary_min" hint="Optional, yearly.">
                  <Input id="salary_min" type="number" min={0} value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="1800000" />
                </Field>
                <Field label="Salary maximum" htmlFor="salary_max">
                  <Input id="salary_max" type="number" min={0} value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="2600000" />
                </Field>
                <Field label="Currency" htmlFor="salary_currency">
                  <Select id="salary_currency" value={form.salary_currency} onChange={(e) => set('salary_currency', e.target.value)}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </Select>
                </Field>
              </div>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="font-display text-[19px] text-ink">Description</h2>
            <p className="mt-1 text-[12.5px] text-muted">Plain text. Line breaks are preserved on the public page.</p>
            <div className="mt-4 space-y-4">
              <Field label="About the role" htmlFor="description" required>
                <Textarea id="description" rows={7} value={form.description} onChange={(e) => set('description', e.target.value)} required placeholder="What the person will work on, with whom, and why it matters." />
              </Field>
              <Field label="Responsibilities" htmlFor="responsibilities" hint="One per line.">
                <Textarea id="responsibilities" rows={5} value={form.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} />
              </Field>
              <Field label="Qualifications" htmlFor="qualifications" hint="One per line. Keep requirements honest.">
                <Textarea id="qualifications" rows={5} value={form.qualifications} onChange={(e) => set('qualifications', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card card-pad">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[19px] text-ink">Application questions</h2>
                <p className="mt-1 text-[12.5px] text-muted">Optional. Ask only what you will read and use.</p>
              </div>
              <Button type="button" size="sm" icon={<Plus size={13} />} onClick={addField}>Add question</Button>
            </div>
            {fields.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-rule px-3 py-4 text-[12.5px] text-muted">
                No extra questions. Candidates will submit contact details, a resume and a short note.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {fields.map((field, index) => (
                  <div key={index} className="rounded-md border border-rule bg-paper/50 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_130px_100px_auto]">
                      <Field label="Question">
                        <Input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} placeholder="Portfolio URL" />
                      </Field>
                      <Field label="Type">
                        <Select value={field.type} onChange={(e) => updateField(index, { type: e.target.value as FormField['type'] })}>
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="url">URL</option>
                          <option value="select">Choice</option>
                        </Select>
                      </Field>
                      <Field label="Required">
                        <Select value={field.required ? 'yes' : 'no'} onChange={(e) => updateField(index, { required: e.target.value === 'yes' })}>
                          <option value="no">Optional</option>
                          <option value="yes">Required</option>
                        </Select>
                      </Field>
                      <div className="flex items-end pb-0.5">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setFields((f) => f.filter((_, i) => i !== index))} aria-label={`Remove question ${index + 1}`}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    {field.type === 'select' && (
                      <Field label="Choices" hint="Comma separated." className="mt-3">
                        <Input
                          value={(field.options || []).join(', ')}
                          onChange={(e) => updateField(index, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                        />
                      </Field>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && <p className="rounded-md border border-negative/20 bg-negativeSoft px-3 py-2 text-[13px] text-negative" role="alert">{error}</p>}
          {fieldError && <p className="rounded-md border border-negative/20 bg-negativeSoft px-3 py-2 text-[13px] text-negative" role="alert">{fieldError}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={saving}>{mode === 'new' ? 'Save draft' : 'Save changes'}</Button>
            <Link to={mode === 'edit' && id ? `/jobs/${id}` : '/jobs'}><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </div>

        <aside className="space-y-5">
          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Hiring</h2>
            <div className="mt-4 space-y-4">
              <Field label="Hiring owner" htmlFor="owner" hint="They receive edit access to this role.">
                <Select id="owner" value={form.hiring_owner_id} onChange={(e) => set('hiring_owner_id', e.target.value)}>
                  <option value="">Me ({members.length ? 'default' : 'owner'})</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Application deadline" htmlFor="deadline" hint="The public form stops accepting after this date.">
                <Input id="deadline" type="date" value={form.application_deadline} onChange={(e) => set('application_deadline', e.target.value)} />
              </Field>
              <Field label="Privacy notice version" htmlFor="notice" hint="Recorded on each consent.">
                <Input id="notice" value={form.privacy_notice_version} onChange={(e) => set('privacy_notice_version', e.target.value)} />
              </Field>
            </div>
          </section>
          <section className="rounded-card border border-rule bg-[#f4f0e6] p-4">
            <p className="text-[12.5px] font-medium text-ink">Publishing checklist</p>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-graphite">
              {['Title and a real description', 'Location or remote status', 'Salary range if you have one', 'A named hiring owner'].map((item) => (
                <li key={item} className="flex items-start gap-1.5"><Check size={12} className="mt-1 shrink-0 text-accent" /> {item}</li>
              ))}
            </ul>
          </section>
        </aside>
      </form>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Job detail                                                                 */
/* -------------------------------------------------------------------------- */
interface JobDetail {
  job: Job;
  team: { id: string; role: string; user_id: string; full_name: string; email: string }[];
  stages: Stage[];
  scorecard: { id: string; name: string; description: string | null; items: ScorecardItem[] } | null;
  counts: JobCounts;
  hiring_owner: { id: string; full_name: string; email: string } | null;
  access: string;
}

export function JobDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'team' | 'scorecard'>('overview');
  const [statusBusy, setStatusBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [inviteUser, setInviteUser] = useState('');
  const [inviteRole, setInviteRole] = useState('interviewer');
  const [scorecard, setScorecard] = useState<{ name: string; description: string; items: ScorecardItem[] }>({ name: '', description: '', items: [] });
  const [savingScorecard, setSavingScorecard] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const canManage = data?.access === 'manage' || data?.access === 'edit';
  const canArchive = session?.membership?.role === 'owner' || session?.membership?.role === 'admin';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api<JobDetail>(`/jobs/${id}`);
      setData(detail);
      setScorecard({
        name: detail.scorecard?.name || `${detail.job.title} interview`,
        description: detail.scorecard?.description || '',
        items: detail.scorecard?.items || [],
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

  async function changeStatus(status: string) {
    setStatusBusy(true);
    try {
      await api(`/jobs/${id}/status`, { body: { status } });
      push(status === 'published' ? 'Role published. The public page is live.' : status === 'closed' ? 'Role closed. It no longer accepts applications.' : 'Role updated.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setStatusBusy(false);
    }
  }

  async function openTeam() {
    setAddOpen(true);
    try {
      const meta = await api<{ members: { id: string; full_name: string; role: string }[] }>('/jobs/meta/members');
      setMembers(meta.members);
      setInviteUser(meta.members[0]?.id || '');
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  }

  async function addMember() {
    if (!inviteUser) return;
    try {
      await api(`/jobs/${id}/team`, { body: { user_id: inviteUser, role: inviteRole } });
      push('Hiring team updated.');
      setAddOpen(false);
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  }

  async function removeMember(membershipId: string) {
    try {
      await api(`/jobs/${id}/team/${membershipId}`, { method: 'DELETE' });
      push('Removed from the hiring team.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    }
  }

  async function saveScorecard() {
    setSavingScorecard(true);
    try {
      await api(`/jobs/${id}/scorecard`, {
        method: 'PUT',
        body: {
          name: scorecard.name,
          description: scorecard.description || null,
          items: scorecard.items.map((i) => ({ id: i.id?.startsWith('new_') ? undefined : i.id, competency: i.competency, description: i.description, anchors: i.anchors })),
        },
      });
      push('Scorecard template saved.');
      await load();
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setSavingScorecard(false);
    }
  }

  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return null;
  const job = data.job;

  return (
    <>
      <PageHeader
        title={job.title}
        back={<Link to="/jobs" className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"><ArrowLeft size={13} /> Roles</Link>}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={job.status === 'published' ? 'success' : job.status === 'draft' ? 'warning' : 'neutral'}>{STATUS_LABELS[job.status]}</Badge>
            <span>{[job.department, job.location ? `${workMode(job.work_mode)} · ${job.location}` : workMode(job.work_mode)].filter(Boolean).join(' · ')}</span>
            {job.application_deadline && <span>· deadline {formatDate(new Date(job.application_deadline).getTime())}</span>}
          </span>
        }
        actions={
          <>
            {job.status === 'published' && (
              <a href={`/careers/${job.slug}`} target="_blank" rel="noreferrer"><Button icon={<ExternalLink size={14} />}>Public page</Button></a>
            )}
            <Link to={`/jobs/${job.id}/pipeline`}><Button variant="primary" icon={<Users size={14} />}>Pipeline</Button></Link>
            {canManage && <Link to={`/jobs/${job.id}/edit`}><Button>Edit</Button></Link>}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active', value: data.counts.active_applications || 0 },
          { label: 'New', value: data.counts.new_applications || 0 },
          { label: 'Total', value: data.counts.total_applications || 0 },
          { label: 'Upcoming interviews', value: data.counts.upcoming_interviews || 0 },
        ].map((stat) => (
          <div key={stat.label} className="card px-4 py-3">
            <p className="text-[11.5px] text-muted">{stat.label}</p>
            <p className="mt-1 font-display text-[24px] leading-none text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1.5 border-b border-rule pb-2" role="tablist">
        {([['overview', 'Overview'], ['team', 'Hiring team'], ['scorecard', 'Scorecard']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-md px-2.5 py-1.5 text-[12.5px] ${tab === key ? 'bg-accentSoft font-medium text-accentDark' : 'text-graphite hover:bg-subtle'}`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {job.status === 'draft' && canManage && <Button size="sm" variant="primary" loading={statusBusy} onClick={() => changeStatus('published')}>Publish</Button>}
          {job.status === 'published' && canManage && <Button size="sm" loading={statusBusy} onClick={() => changeStatus('closed')}>Close applications</Button>}
          {job.status === 'closed' && canManage && <Button size="sm" loading={statusBusy} onClick={() => changeStatus('published')}>Reopen</Button>}
          {job.status !== 'archived' && canArchive && <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(true)}>Archive</Button>}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <section className="card card-pad">
              <h2 className="font-display text-[19px] text-ink">Role description</h2>
              <div className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.75] text-graphite">{job.description}</div>
              {job.responsibilities && (
                <>
                  <h3 className="mt-6 text-[13px] font-medium text-ink">Responsibilities</h3>
                  <div className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-graphite">{job.responsibilities}</div>
                </>
              )}
              {job.qualifications && (
                <>
                  <h3 className="mt-6 text-[13px] font-medium text-ink">Qualifications</h3>
                  <div className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-graphite">{job.qualifications}</div>
                </>
              )}
            </section>

            {(job.application_fields?.length || 0) > 0 && (
              <section className="card card-pad">
                <h2 className="font-display text-[19px] text-ink">Application questions</h2>
                <ol className="mt-3 space-y-2.5">
                  {job.application_fields!.map((field) => (
                    <li key={field.key} className="flex items-start gap-2 text-[13.5px] text-graphite">
                      <span className="font-mono text-[11px] text-muted">{field.required ? 'required' : 'optional'}</span>
                      {field.label}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <div className="space-y-5">
            <section className="card card-pad">
              <h2 className="font-display text-[17px] text-ink">Details</h2>
              <div className="mt-4">
                <DefinitionList
                  items={[
                    { label: 'Hiring owner', value: data.hiring_owner?.full_name || 'Unassigned' },
                    { label: 'Salary', value: salary(job) || 'Not published' },
                    { label: 'Employment', value: job.employment_type.replace('_', ' ') },
                    { label: 'Work mode', value: workMode(job.work_mode) },
                    { label: 'Published', value: job.published_at ? formatDate(job.published_at) : 'Not yet' },
                    { label: 'Public URL', value: <a className="text-accent underline underline-offset-2" href={`/careers/${job.slug}`} target="_blank" rel="noreferrer">/careers/{job.slug}</a> },
                  ]}
                />
              </div>
            </section>
            <section className="card card-pad">
              <h2 className="font-display text-[17px] text-ink">Default pipeline</h2>
              <ol className="mt-3 space-y-1.5">
                {data.stages.map((stage) => (
                  <li key={stage.id} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-graphite">{stage.name}</span>
                    <span className="font-mono text-[10.5px] text-muted">{stage.kind}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <section className="card">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <div>
              <h2 className="text-[14px] font-medium text-ink">Hiring team</h2>
              <p className="mt-0.5 text-[12px] text-muted">Interviewers only see the packets for interviews they are assigned to.</p>
            </div>
            {canManage && <Button size="sm" icon={<Plus size={13} />} onClick={openTeam}>Add person</Button>}
          </div>
          {data.team.length === 0 ? (
            <EmptyState title="No team assigned" icon={<Users size={18} />}>The hiring owner can add a recruiter, manager and interviewers.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule/80">
              {data.team.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{member.full_name}</p>
                    <p className="text-[12px] text-muted">{member.email}</p>
                  </div>
                  <Badge tone="accent">{member.role.replace('_', ' ')}</Badge>
                  {canManage && member.user_id !== job.hiring_owner_id && (
                    <Button size="sm" variant="ghost" onClick={() => removeMember(member.id)} aria-label={`Remove ${member.full_name}`}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'scorecard' && (
        <section className="card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[19px] text-ink">Interview scorecard</h2>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-muted">
                Competencies are rated 1–5 by a human interviewer with written evidence. Anchors describe what a 1, 3 and 5 look like. Ratings never decide an outcome automatically.
              </p>
            </div>
            {canManage && <Button size="sm" onClick={() => setScorecard((s) => ({ ...s, items: [...s.items, { id: `new_${Date.now()}`, competency: '', description: '', anchors: {}, position: s.items.length }] }))} icon={<Plus size={13} />}>Add competency</Button>}
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Template name">
                <Input value={scorecard.name} onChange={(e) => setScorecard((s) => ({ ...s, name: e.target.value }))} disabled={!canManage} />
              </Field>
              <Field label="Description">
                <Input value={scorecard.description} onChange={(e) => setScorecard((s) => ({ ...s, description: e.target.value }))} disabled={!canManage} />
              </Field>
            </div>
            {scorecard.items.length === 0 && <p className="rounded-md border border-dashed border-rule px-3 py-4 text-[12.5px] text-muted">No competencies yet. Add three to five that map to the role.</p>}
            {scorecard.items.map((item, index) => (
              <div key={item.id} className="rounded-md border border-rule bg-paper/40 p-3.5">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Competency">
                    <Input value={item.competency} disabled={!canManage} onChange={(e) => setScorecard((s) => ({ ...s, items: s.items.map((x, i) => (i === index ? { ...x, competency: e.target.value } : x)) }))} placeholder="Product judgement" />
                  </Field>
                  <Field label="What it covers">
                    <Input value={item.description || ''} disabled={!canManage} onChange={(e) => setScorecard((s) => ({ ...s, items: s.items.map((x, i) => (i === index ? { ...x, description: e.target.value } : x)) }))} />
                  </Field>
                  <div className="flex items-end pb-1">
                    {canManage && <Button variant="ghost" size="sm" onClick={() => setScorecard((s) => ({ ...s, items: s.items.filter((_, i) => i !== index) }))} aria-label="Remove competency"><Trash2 size={14} /></Button>}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(['1', '3', '5'] as const).map((level) => (
                    <Field key={level} label={`Anchor at ${level}`}>
                      <Input
                        value={item.anchors?.[level] || ''}
                        disabled={!canManage}
                        onChange={(e) => setScorecard((s) => ({
                          ...s,
                          items: s.items.map((x, i) => (i === index ? { ...x, anchors: { ...x.anchors, [level]: e.target.value } } : x)),
                        }))}
                        placeholder={level === '1' ? 'What a weak answer looks like' : level === '5' ? 'What excellent looks like' : 'What solid looks like'}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {canManage && (
            <div className="mt-5 flex justify-end">
              <Button variant="primary" loading={savingScorecard} onClick={saveScorecard} icon={<ClipboardCheck size={15} />}>Save scorecard</Button>
            </div>
          )}
        </section>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add to hiring team"
        description="Recruiters and managers can see the pipeline. Interviewers only receive assigned interview packets."
        footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" onClick={addMember} disabled={!inviteUser}>Add person</Button></>}
      >
        <div className="space-y-4">
          <Field label="Person">
            <Select value={inviteUser} onChange={(e) => setInviteUser(e.target.value)}>
              {members.filter((m) => !data.team.some((t) => t.user_id === m.id)).map((m) => (
                <option key={m.id} value={m.id}>{m.full_name} · {m.role.replace('_', ' ')}</option>
              ))}
            </Select>
          </Field>
          <Field label="Role on this role">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="interviewer">Interviewer</option>
              <option value="hiring_manager">Hiring manager</option>
              <option value="recruiter">Recruiter</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this role?"
        description="The public page is removed and the role becomes read-only. Applications and their history are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>Keep role</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api(`/jobs/${id}`, { method: 'DELETE' });
                  push('Role archived.');
                  setConfirmArchive(false);
                  await load();
                } catch (err) {
                  push(errorMessage(err), 'error');
                }
              }}
            >
              Archive role
            </Button>
          </>
        }
      />
    </>
  );
}
