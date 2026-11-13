import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Paperclip,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, Field, Input, LoadingBlock, Select, Textarea } from '../components/ui';
import { formatDate, salary, workMode } from '../lib/format';
import type { FormField, Job } from '../types';

interface PublicOrg {
  name: string;
  slug: string;
  careers_intro: string | null;
  website: string | null;
  privacy_notice_version: string;
  privacy_notice_url: string | null;
}

interface PublicJob extends Job {
  accepting_applications?: boolean;
}

interface CareersData {
  organization: PublicOrg;
  jobs: PublicJob[];
}

interface JobData {
  organization: PublicOrg;
  job: PublicJob;
}

const WORK_MODE_LABEL: Record<string, string> = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };
const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  internship: 'Internship',
};

function JobMeta({ job }: { job: PublicJob }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-graphite">
      <span className="inline-flex items-center gap-1.5"><Briefcase size={13} className="text-muted" /> {EMPLOYMENT_LABEL[job.employment_type] || job.employment_type}</span>
      <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-muted" /> {job.location ? `${WORK_MODE_LABEL[job.work_mode]} · ${job.location}` : WORK_MODE_LABEL[job.work_mode]}</span>
      {salary(job) && <span className="font-mono text-[11.5px] text-graphite">{salary(job)}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Careers index                                                              */
/* -------------------------------------------------------------------------- */
export function CareersPage() {
  const [data, setData] = useState<CareersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setData(await api<CareersData>('/public/careers'));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-5 py-14"><LoadingBlock rows={4} /></div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-display text-[30px] text-ink">No careers page is live</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-graphite">
          This deployment has no published roles yet, or the careers page is not configured. If you followed a link from a hiring team, ask them for the current role URL.
        </p>
        <Link to="/" className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent underline underline-offset-2">Back to HireFlow Lite <ArrowRight size={13} /></Link>
      </div>
    );
  }

  const { organization, jobs } = data;
  const open = jobs.filter((job) => job.accepting_applications !== false);
  const closed = jobs.filter((job) => job.accepting_applications === false);

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">Careers at {organization.name}</p>
        <h1 className="mt-3 font-display text-[40px] leading-[1.06] text-ink sm:text-[52px]">Work worth doing, described honestly.</h1>
        <p className="mt-4 text-[15px] leading-[1.75] text-graphite">
          {organization.careers_intro ||
            'Every open role is listed here with its location, working mode and salary range where we have one. Applications are read by the hiring team, not scored by a machine.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Your resume stays private</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={13} /> Every candidate gets a clear answer</span>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-baseline justify-between border-b border-rule pb-2.5">
          <h2 className="text-[13px] font-medium text-ink">Open roles</h2>
          <span className="font-mono text-[11px] text-muted">{open.length} {open.length === 1 ? 'role' : 'roles'}</span>
        </div>

        {open.length === 0 ? (
          <div className="mt-4 rounded-card border border-rule bg-surface px-6 py-10 text-center">
            <p className="font-display text-[22px] text-ink">Nothing open right now</p>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
              We are not accepting applications for any role at the moment. This page updates as soon as a role is published.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {open.map((job) => (
              <li key={job.id} className="card group transition-colors hover:border-accent/35">
                <Link to={`/careers/${job.slug}`} className="block p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[22px] leading-tight text-ink group-hover:text-accentDark">{job.title}</h3>
                      <div className="mt-2"><JobMeta job={job} /></div>
                    </div>
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-[12px] text-graphite group-hover:border-accent/40 group-hover:text-accentDark">
                      Read role <ArrowRight size={12} />
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-graphite">
                    {job.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
                    {job.department && <span>{job.department}</span>}
                    {job.application_deadline && <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> Apply by {formatDate(new Date(job.application_deadline).getTime())}</span>}
                    {job.published_at && <span>Published {formatDate(job.published_at)}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {closed.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[12px] font-medium text-muted">Recently closed</h2>
            <ul className="mt-2 divide-y divide-rule/70 rounded-card border border-rule bg-surface/60">
              {closed.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12.5px]">
                  <Link to={`/careers/${job.slug}`} className="text-graphite hover:underline">{job.title}</Link>
                  <Badge>Closed</Badge>
                  <span className="ml-auto text-[11px] text-muted">{job.location || WORK_MODE_LABEL[job.work_mode]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-12 rounded-card border border-rule bg-[#f4f0e6] px-5 py-4">
        <p className="text-[12.5px] leading-relaxed text-graphite">
          {organization.name} uses HireFlow Lite to manage applications. Read the{' '}
          <Link to="/privacy" className="text-accent underline underline-offset-2">privacy notice</Link>{' '}
          before applying. The notice version at the time of your application is recorded with your consent.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Job detail                                                                 */
/* -------------------------------------------------------------------------- */
export function CareerJobPage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setData(await api<JobData>(`/public/careers/${encodeURIComponent(slug)}`));
      } catch (err) {
        setError(errorMessage(err));
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-6xl px-5 py-14"><LoadingBlock rows={5} /></div>;
  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-display text-[30px] text-ink">Role not found</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-graphite">{error || 'This role may have been closed or removed.'}</p>
        <Link to="/careers" className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent underline underline-offset-2"><ArrowLeft size={13} /> All open roles</Link>
      </div>
    );
  }

  const { organization, job } = data;
  const accepting = job.accepting_applications !== false;
  const responsibilities = (job.responsibilities || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const qualifications = (job.qualifications || '').split('\n').map((line) => line.trim()).filter(Boolean);

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <Link to="/careers" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink">
        <ArrowLeft size={13} /> {organization.name} careers
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start lg:gap-12">
        <article className="min-w-0">
          <h1 className="font-display text-[36px] leading-[1.08] text-ink sm:text-[46px]">{job.title}</h1>
          <div className="mt-3"><JobMeta job={job} /></div>
          {job.department && <p className="mt-1 text-[12px] text-muted">{job.department}</p>}

          <div className="mt-7 space-y-8">
            <section>
              <h2 className="text-[12px] font-medium text-muted">About the role</h2>
              <div className="mt-2 whitespace-pre-wrap text-[14.5px] leading-[1.8] text-graphite">{job.description}</div>
            </section>

            {responsibilities.length > 0 && (
              <section>
                <h2 className="text-[12px] font-medium text-muted">What you will do</h2>
                <ul className="mt-2 space-y-2">
                  {responsibilities.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-graphite">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      {line.replace(/^[-•*]\s*/, '')}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {qualifications.length > 0 && (
              <section>
                <h2 className="text-[12px] font-medium text-muted">What we are looking for</h2>
                <ul className="mt-2 space-y-2">
                  {qualifications.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-graphite">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      {line.replace(/^[-•*]\s*/, '')}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-[12px] font-medium text-muted">How we hire</h2>
              <ol className="mt-2 space-y-2.5">
                {[
                  'A person on the hiring team reads your application and resume.',
                  'If there is a fit, we invite you to a conversation and explain what it will cover.',
                  'Interviewers write structured notes; the decision is made by people, not a score.',
                  'Every candidate hears back, including a reason when the answer is no.',
                ].map((line, index) => (
                  <li key={line} className="flex items-start gap-3 text-[13.5px] leading-relaxed text-graphite">
                    <span className="mt-0.5 font-mono text-[10.5px] text-muted">{String(index + 1).padStart(2, '0')}</span>
                    {line}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="card card-pad">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-muted">Application</p>
              <Badge tone={accepting ? 'success' : 'neutral'}>{accepting ? 'Open' : 'Closed'}</Badge>
            </div>
            {job.application_deadline && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-graphite">
                <CalendarClock size={13} /> Apply by {formatDate(new Date(job.application_deadline).getTime())}
              </p>
            )}
            {accepting ? (
              <Link to={`/careers/${job.slug}/apply`}>
                <Button variant="primary" className="mt-4 w-full" icon={<ArrowRight size={15} />}>Apply for this role</Button>
              </Link>
            ) : (
              <p className="mt-4 rounded-md border border-rule bg-subtle/50 px-3 py-2.5 text-[12px] leading-relaxed text-graphite">
                This role stopped accepting applications{job.application_deadline ? ` after ${formatDate(new Date(job.application_deadline).getTime())}` : ''}. You can still read the description.
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-rule pt-3 text-[11.5px] leading-relaxed text-muted">
              <p className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0" /> Resume as PDF or DOCX, up to 5 MB.</p>
              <p className="flex items-start gap-1.5"><ShieldCheck size={12} className="mt-0.5 shrink-0" /> We record the privacy notice version you accept.</p>
              <p className="flex items-start gap-1.5"><Clock size={12} className="mt-0.5 shrink-0" /> You can withdraw or request deletion from your status link.</p>
            </div>
          </div>

          <div className="rounded-card border border-rule bg-[#f4f0e6] p-4">
            <p className="text-[12px] font-medium text-ink">Need an adjustment?</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-graphite">
              If the application form or interview format is a barrier, tell the hiring team. Adjustments are handled by a person, not scored.
            </p>
          </div>

          {job.application_fields && job.application_fields.length > 0 && (
            <div className="card p-4">
              <p className="text-[12px] font-medium text-ink">You will be asked</p>
              <ul className="mt-2 space-y-1.5">
                {job.application_fields.map((field) => (
                  <li key={field.key} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-graphite">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    {field.label}{field.required ? <span className="text-negative">*</span> : <span className="text-muted"> (optional)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Application form                                                           */
/* -------------------------------------------------------------------------- */
export function CareerApplyPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    linkedin_url: '',
    portfolio_url: '',
    cover_note: '',
    website: '',
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [fieldNote, setFieldNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ application_reference: string; portal_url: string; message: string } | null>(null);
  const startedAt = useRef(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setData(await api<JobData>(`/public/careers/${encodeURIComponent(slug)}`));
      } catch (err) {
        setLoadError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    const source = params.get('utm_source');
    if (source) {
      // Source attribution is carried into the form by the server when present.
      startedAt.current = Date.now();
    }
  }, [params]);

  const job = data?.job;
  const org = data?.organization;
  const customFields: FormField[] = useMemo(() => job?.application_fields || [], [job]);

  function pickFile(next: File | null) {
    setError('');
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setFile(null);
      setError('Resume must be 5 MB or smaller.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const name = next.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setFile(null);
      setError('Attach a PDF or DOCX file. The file signature is checked on upload.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setFile(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldNote('');
    if (!job) return;
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Enter your full name and email address.');
      return;
    }
    if (!file) {
      setError('Attach your resume as a PDF or DOCX file.');
      return;
    }
    if (!consent) {
      setError('Confirm that you have read the privacy notice.');
      return;
    }
    for (const field of customFields) {
      if (field.required && !String(answers[field.key] || '').trim()) {
        setFieldNote(`“${field.label}” is required for this role.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set('full_name', form.full_name.trim());
      body.set('email', form.email.trim());
      body.set('phone', form.phone.trim());
      body.set('location', form.location.trim());
      body.set('linkedin_url', form.linkedin_url.trim());
      body.set('portfolio_url', form.portfolio_url.trim());
      body.set('cover_note', form.cover_note.trim());
      body.set('consent', 'yes');
      body.set('website', form.website);
      body.set('started_at', String(startedAt.current));
      body.set('source', params.get('utm_source') ? 'careers_page' : 'careers_page');
      body.set('utm_source', params.get('utm_source') || '');
      body.set('utm_medium', params.get('utm_medium') || '');
      body.set('utm_campaign', params.get('utm_campaign') || '');
      for (const field of customFields) {
        body.set(`field_${field.key}`, String(answers[field.key] || ''));
      }
      body.set('resume', file);
      const response = await api<{ application_reference: string; portal_url: string; message: string }>(
        `/public/careers/${encodeURIComponent(job.slug)}/apply`,
        { formData: body },
      );
      setResult(response);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-14"><LoadingBlock rows={6} /></div>;
  if (loadError || !job || !org) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-display text-[30px] text-ink">Role not available</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-graphite">{loadError || 'This role could not be loaded.'}</p>
        <Link to="/careers" className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent underline underline-offset-2"><ArrowLeft size={13} /> All open roles</Link>
      </div>
    );
  }

  if (result) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
        <div className="card overflow-hidden">
          <div className="border-b border-rule bg-positiveSoft/50 px-6 py-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-positive"><CheckCircle2 size={18} /></span>
            <h1 className="mt-3 font-display text-[30px] leading-tight text-ink">Application received</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-graphite">{result.message}</p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div>
              <p className="text-[11px] text-muted">Reference</p>
              <p className="mt-0.5 font-mono text-[14px] text-ink">{result.application_reference}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Your private status link</p>
              <p className="mt-1 break-all rounded-md border border-rule bg-paper/70 px-3 py-2.5 font-mono text-[11px] text-graphite">{result.portal_url}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                Save this link. It is the only way to check your status without an account. Do not share it: anyone with the link can see this application.
              </p>
            </div>
            <div className="rounded-md border border-warning/25 bg-warningSoft/50 px-3 py-2.5">
              <p className="text-[11.5px] leading-relaxed text-warning">
                This deployment has no email provider configured. The acknowledgement was saved to the application log but not emailed.
                Keep the link above.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
              <Link to={`/portal/${encodeURIComponent(result.portal_url.split('/').pop() || '')}`}>
                <Button variant="primary">Open my status page</Button>
              </Link>
              <Link to="/careers"><Button>Back to careers</Button></Link>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[11.5px] text-muted">
          {org.name} · if anything is wrong, reply to the hiring team or use the data request option on your status page.
        </p>
      </section>
    );
  }

  const accepting = job.accepting_applications !== false;
  if (!accepting) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16">
        <div className="card card-pad text-center">
          <Badge>Closed</Badge>
          <h1 className="mt-3 font-display text-[28px] text-ink">This role is not accepting applications</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-graphite">
            {job.application_deadline ? `The deadline was ${formatDate(new Date(job.application_deadline).getTime())}. ` : ''}
            You can still read the role description.
          </p>
          <Link to={`/careers/${job.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent underline underline-offset-2">Read the role <ArrowRight size={13} /></Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <Link to={`/careers/${job.slug}`} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink">
        <ArrowLeft size={13} /> {job.title}
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_290px] lg:items-start lg:gap-12">
        <div className="min-w-0">
          <p className="eyebrow">Application</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight text-ink sm:text-[40px]">{job.title}</h1>
          <div className="mt-2"><JobMeta job={job} /></div>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-graphite">
            A person reads every application. Tell us what matters for this role; there is no keyword score.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-6" noValidate>
            <section className="space-y-4">
              <h2 className="text-[13px] font-medium text-ink">About you</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="full_name" required>
                  <Input id="full_name" autoComplete="name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
                </Field>
                <Field label="Email" htmlFor="email" required hint="We reply to this address.">
                  <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                </Field>
                <Field label="Phone" htmlFor="phone" hint="Optional.">
                  <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Location" htmlFor="location" hint="City and country is enough.">
                  <Input id="location" autoComplete="address-level2" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                </Field>
                <Field label="LinkedIn" htmlFor="linkedin" hint="Optional, full URL.">
                  <Input id="linkedin" type="url" value={form.linkedin_url} onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://" />
                </Field>
                <Field label="Portfolio or website" htmlFor="portfolio" hint="Optional, full URL.">
                  <Input id="portfolio" type="url" value={form.portfolio_url} onChange={(e) => setForm((f) => ({ ...f, portfolio_url: e.target.value }))} placeholder="https://" />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[13px] font-medium text-ink">Your application</h2>
              <Field label="Resume" required hint="PDF or DOCX, up to 5 MB. Checked by file signature, not just the extension.">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] || null); }}
                  className={`rounded-md border border-dashed px-4 py-5 text-center transition-colors ${dragging ? 'border-accent bg-accentSoft/50' : 'border-rule bg-paper/40'}`}
                >
                  {file ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <FileText size={16} className="text-accent" />
                      <div className="text-left">
                        <p className="text-[12.5px] font-medium text-ink">{file.name}</p>
                        <p className="text-[11px] text-muted">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        className="rounded p-1 text-muted hover:bg-subtle hover:text-ink"
                        onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                        aria-label="Remove resume"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={18} className="mx-auto text-muted" />
                      <p className="mt-2 text-[12.5px] text-graphite">Drop your resume here, or choose a file.</p>
                      <label className="mt-2 inline-block cursor-pointer rounded-md border border-rule bg-surface px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-subtle">
                        Choose file
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="sr-only"
                          onChange={(e) => pickFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </>
                  )}
                </div>
              </Field>

              <Field label="Cover note" htmlFor="cover_note" hint="Optional. Why this role, and what you would bring to it.">
                <Textarea id="cover_note" rows={5} value={form.cover_note} onChange={(e) => setForm((f) => ({ ...f, cover_note: e.target.value }))} />
              </Field>

              {customFields.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  htmlFor={`field_${field.key}`}
                  required={field.required}
                  hint={field.type === 'url' ? 'Full URL including https://' : undefined}
                >
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`field_${field.key}`}
                      rows={4}
                      value={answers[field.key] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <Select
                      id={`field_${field.key}`}
                      value={answers[field.key] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                    >
                      <option value="">Choose one</option>
                      {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                  ) : (
                    <Input
                      id={`field_${field.key}`}
                      type={field.type === 'url' ? 'url' : 'text'}
                      value={answers[field.key] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
            </section>

            <section className="rounded-card border border-rule bg-surface p-4">
              <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-graphite">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
                <span>
                  I have read the <Link to="/privacy" target="_blank" className="text-accent underline underline-offset-2">privacy notice</Link>{' '}
                  (version <span className="font-mono text-[11px]">{job.privacy_notice_version || org.privacy_notice_version}</span>) and agree that{' '}
                  {org.name} may process this application for this role. I understand I can withdraw or request deletion from my status link.
                </span>
              </label>
              <div className="sr-only" aria-hidden>
                <label htmlFor="website">Leave this field empty</label>
                <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
            </section>

            {error && (
              <p className="rounded-md border border-negative/20 bg-negativeSoft px-3 py-2.5 text-[13px] leading-relaxed text-negative" role="alert">{error}</p>
            )}
            {fieldNote && (
              <p className="rounded-md border border-negative/20 bg-negativeSoft px-3 py-2.5 text-[13px] leading-relaxed text-negative" role="alert">{fieldNote}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" loading={submitting} icon={<Send size={14} />}>
                Submit application
              </Button>
              <p className="text-[11.5px] text-muted">You will get a private status link on the next screen.</p>
            </div>
          </form>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="card p-4">
            <p className="text-[12px] font-medium text-ink">What happens next</p>
            <ol className="mt-2.5 space-y-2.5">
              {[
                'A person on the hiring team reads your application.',
                'You get a private link to check status at any time.',
                'If we move forward, we explain the next conversation.',
                'Every candidate hears the outcome.',
              ].map((line, index) => (
                <li key={line} className="flex items-start gap-2.5 text-[11.5px] leading-relaxed text-graphite">
                  <span className="mt-0.5 font-mono text-[10px] text-muted">{index + 1}</span>
                  {line}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-card border border-rule bg-[#f4f0e6] p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink"><Paperclip size={13} /> Before you submit</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-graphite">
              <li className="flex items-start gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-accent" /> Name, email and a resume.</li>
              <li className="flex items-start gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-accent" /> Links start with http:// or https://.</li>
              <li className="flex items-start gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-accent" /> The privacy notice is accepted.</li>
            </ul>
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            One application per email per role. If you already applied, use your existing status link instead of submitting again.
          </p>
        </aside>
      </div>
      <div className="mt-10 border-t border-rule pt-4 text-[11.5px] text-muted">
        <p>{org.name} · {job.title} · <Link to="/privacy" className="underline underline-offset-2 hover:text-graphite">Privacy</Link></p>
      </div>
    </section>
  );
}
