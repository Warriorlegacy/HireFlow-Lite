export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
  open: 'Open',
  sent: 'Sent',
  failed: 'Failed',
  not_configured: 'Not sent',
  strong_yes: 'Strong yes',
  yes: 'Yes',
  no: 'No',
  strong_no: 'Strong no',
};

export const SOURCE_LABELS: Record<string, string> = {
  careers_page: 'Careers page',
  referral: 'Referral',
  linkedin: 'LinkedIn',
  job_board: 'Job board',
  import: 'CSV import',
  outbound: 'Outbound',
  agency: 'Agency',
  unknown: 'Unknown',
};

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(ms: number | null | undefined, timeZone?: string): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

export function formatTime(ms: number, timeZone?: string): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone });
}

export function timeAgo(ms: number | null | undefined): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ms);
}

export function daysIn(ms: number | null | undefined): number {
  if (!ms) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

export function initials(name: string | null | undefined): string {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function salary(job: { salary_min?: number | null; salary_max?: number | null; salary_currency?: string }): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: job.salary_currency || 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  return fmt((job.salary_min || job.salary_max)!);
}

export function workMode(mode: string): string {
  return mode === 'remote' ? 'Remote' : mode === 'hybrid' ? 'Hybrid' : 'On-site';
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isoToInput(value: string | null | undefined): string {
  return value || '';
}

export function msToLocalInput(ms: number): string {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function inputToMs(value: string): number {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
