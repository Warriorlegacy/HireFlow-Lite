import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { api, download, errorMessage } from '../lib/api';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  useToast,
} from '../components/ui';
import type { Job } from '../types';

interface PreviewRow {
  row: number;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  portfolio_url: string;
  source: string;
  source_detail: string;
  cover_note: string;
  status: 'ready' | 'duplicate' | 'invalid';
  errors: string[];
}

interface Preview {
  rows: PreviewRow[];
  summary: { total: number; ready: number; duplicate: number; invalid: number };
  note: string;
}

const TEMPLATE_CSV = [
  'name,email,phone,location,linkedin_url,portfolio_url,source,source_detail,cover_note',
  'Asha Menon,asha.menon@example.test,+91 90000 00000,Bengaluru,https://linkedin.com/in/example,https://example.test/portfolio,referral,Referred by Sam,Short note about the candidate.',
].join('\n');

export function ImportExportPage() {
  const { push } = useToast();
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [attest, setAttest] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [exportJob, setExportJob] = useState('');
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ jobs: Job[] }>('/jobs');
      setJobs(data.jobs);
      const first = data.jobs.find((j) => j.status === 'published') || data.jobs[0];
      if (first) setJobId(first.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => preview?.summary, [preview]);

  async function runPreview() {
    if (!jobId) {
      push('Choose the role to import into.', 'error');
      return;
    }
    if (!file) {
      push('Choose a CSV file first.', 'error');
      return;
    }
    setPreviewing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set('job_id', jobId);
      form.set('file', file);
      const data = await api<Preview>('/import-export/import/preview', { formData: form });
      setPreview(data);
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setPreviewing(false);
    }
  }

  async function commit() {
    if (!preview || !jobId) return;
    if (!attest) {
      push('Confirm the lawful-basis statement before importing.', 'error');
      return;
    }
    setImporting(true);
    try {
      const data = await api<{ imported: number; skipped: number; total: number }>('/import-export/import/commit', {
        body: {
          job_id: jobId,
          attest: true,
          rows: preview.rows.filter((r) => r.status === 'ready'),
        },
      });
      setResult(data);
      setPreview(null);
      setFile(null);
      setAttest(false);
      if (inputRef.current) inputRef.current.value = '';
      push(`${data.imported} imported, ${data.skipped} skipped.`);
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setImporting(false);
    }
  }

  function downloadCombined() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hireflow-import-template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function runExport() {
    setExporting(true);
    try {
      const query = exportJob ? `/import-export/export?job_id=${exportJob}` : '/import-export/export';
      await download(query, `hireflow-applications-${new Date().toISOString().slice(0, 10)}.csv`);
      push('Export downloaded. The action is recorded in the audit log.');
    } catch (err) {
      push(errorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <><PageHeader title="Import & export" /><LoadingBlock rows={5} /></>;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Import & export"
        description="Bring existing candidates in as a one-time move, or take your data out. Every import and export is written to the audit log."
      />

      <div className="mb-5 flex gap-1.5 border-b border-rule pb-2" role="tablist">
        {([['import', 'Import candidates'], ['export', 'Export data']] as const).map(([key, label]) => (
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
      </div>

      {tab === 'import' && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <section className="card card-pad">
              <h2 className="font-display text-[19px] text-ink">1. Choose the role and file</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                CSV up to 2 MB and 300 data rows. Columns are matched by header name. Duplicate emails for the same role are skipped, not merged.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Role" required>
                  <Select value={jobId} onChange={(e) => { setJobId(e.target.value); setPreview(null); }}>
                    {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}{job.status !== 'published' ? ` (${job.status})` : ''}</option>)}
                  </Select>
                </Field>
                <Field label="CSV file" required>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }}
                    className="block w-full text-[12.5px] text-graphite file:mr-3 file:rounded-md file:border file:border-rule file:bg-surface file:px-3 file:py-2 file:text-[12.5px] file:font-medium file:text-ink hover:file:bg-subtle"
                  />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" icon={<Upload size={14} />} loading={previewing} onClick={runPreview}>Preview import</Button>
                <Button variant="ghost" icon={<Download size={13} />} onClick={downloadCombined}>Sample CSV</Button>
              </div>
            </section>

            {preview && (
              <section className="card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
                  <h2 className="text-[14px] font-medium text-ink">2. Review before committing</h2>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="success">{preview.summary.ready} ready</Badge>
                    <Badge tone="warning">{preview.summary.duplicate} duplicate</Badge>
                    <Badge tone="danger">{preview.summary.invalid} invalid</Badge>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-base min-w-[720px]">
                    <thead>
                      <tr>
                        <th className="pl-5">Row</th>
                        <th>Candidate</th>
                        <th>Location</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th className="pr-5">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.row}>
                          <td className="pl-5 font-mono text-[11.5px] text-muted">{row.row}</td>
                          <td>
                            <p className="text-[12.5px] font-medium text-ink">{row.full_name || '—'}</p>
                            <p className="text-[11px] text-muted">{row.email || '—'}</p>
                          </td>
                          <td className="text-[12px] text-muted">{row.location || '—'}</td>
                          <td className="text-[12px] text-muted">{row.source || '—'}</td>
                          <td>
                            <Badge tone={row.status === 'ready' ? 'success' : row.status === 'duplicate' ? 'warning' : 'danger'}>
                              {row.status === 'ready' ? 'Ready' : row.status === 'duplicate' ? 'Duplicate' : 'Invalid'}
                            </Badge>
                          </td>
                          <td className="pr-5 text-[11.5px] leading-relaxed text-muted">
                            {row.errors.length ? row.errors.join(' ') : row.status === 'duplicate' ? 'An application already exists for this email on this role.' : 'Will import into the New stage.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-rule px-5 py-4">
                  <div className="rounded-md border border-warning/25 bg-warningSoft/50 px-3 py-2.5">
                    <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-graphite">
                      <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
                      <span>
                        I confirm this workspace has a lawful basis to process these records, and that consent is being recorded separately where required.
                        Imported records are created with consent marked <span className="font-mono text-[11px]">not recorded</span>.
                      </span>
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11.5px] text-muted">Only the {preview.summary.ready} ready rows will be written.</p>
                    <Button variant="primary" loading={importing} disabled={!attest || preview.summary.ready === 0} onClick={commit} icon={<Check size={14} />}>
                      Import {preview.summary.ready} {preview.summary.ready === 1 ? 'candidate' : 'candidates'}
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {result && (
              <section className="card card-pad border-positive/25 bg-positiveSoft/40">
                <p className="text-[14px] font-medium text-positive">Import finished</p>
                <p className="mt-1 text-[13px] leading-relaxed text-graphite">
                  {result.imported} imported, {result.skipped} skipped, {result.total} rows submitted. The new applications are in the New stage and each has its own stage history entry.
                </p>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <section className="card card-pad">
              <h2 className="font-display text-[17px] text-ink">What import will not do</h2>
              <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-graphite">
                {[
                  'It will not invent consent, resumes or interview history.',
                  'It will not email anyone or mark a message as sent.',
                  'It will not merge duplicates; you get a clear skip count.',
                  'It will not run any ranking or automated screening.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" /> {line}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-card border border-rule bg-[#f4f0e6] p-4">
              <p className="text-[12.5px] font-medium text-ink">Expected columns</p>
              <p className="mt-1 text-[12px] leading-relaxed text-graphite">
                <span className="font-mono text-[11px]">name</span> and <span className="font-mono text-[11px]">email</span> are required.
              </p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-graphite">
                phone, location, linkedin_url, portfolio_url, source, source_detail, cover_note
              </p>
            </section>
          </aside>
        </div>
      )}

      {tab === 'export' && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <section className="card card-pad">
            <h2 className="font-display text-[19px] text-ink">Export applications</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              A CSV of application, candidate, role, stage, status, source and owner fields. Role permissions apply: you only export what you can already see.
            </p>
            <div className="mt-5 max-w-sm">
              <Field label="Role" hint="Leave as all roles to export everything you can access.">
                <Select value={exportJob} onChange={(e) => setExportJob(e.target.value)}>
                  <option value="">All roles I can see</option>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-5">
              <Button variant="primary" icon={<Download size={14} />} loading={exporting} onClick={runExport}>Download CSV</Button>
            </div>
          </section>
          <section className="card card-pad">
            <h2 className="font-display text-[17px] text-ink">Handling exported files</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-graphite">
              A CSV of candidate data is personal data. Store it in an approved location, share it only with people who need it, and delete it when the task is done.
              CSV cells are escaped so spreadsheet software cannot execute a formula from a candidate-provided value.
            </p>
            <div className="mt-4 rounded-md border border-rule bg-paper/60 px-3 py-2.5">
              <p className="text-[11.5px] leading-relaxed text-muted">
                Exporting is recorded with your user, time and row count in the audit log.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
