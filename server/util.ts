export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function clampString(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

export function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / 86400_000));
}

export function startOfDayMs(value: number): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
