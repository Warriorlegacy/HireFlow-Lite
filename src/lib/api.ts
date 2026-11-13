let csrfToken = '';

export function setCsrfToken(token: string | undefined | null) {
  csrfToken = token || '';
}

export function getCsrfToken() {
  return csrfToken;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(path.startsWith('/api') ? path : `/api/v1${path}`, {
    method: options.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    credentials: 'same-origin',
    signal: options.signal,
  });

  const type = res.headers.get('content-type') || '';
  const data: any = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      (res.status === 401
        ? 'Your session has ended. Sign in again.'
        : res.status === 403
          ? 'You do not have permission to do that.'
          : `Request failed (${res.status}).`);
    throw new ApiError(message, res.status, data?.code || 'ERROR');
  }
  return data as T;
}

export async function download(path: string, filename: string) {
  const headers: Record<string, string> = {};
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  const res = await fetch(path.startsWith('/api') ? path : `/api/v1${path}`, { headers, credentials: 'same-origin' });
  if (!res.ok) {
    const data: any = await res.json().catch(() => null);
    throw new ApiError(data?.error || 'Download failed.', res.status, data?.code || 'ERROR');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export function fieldErrors(err: unknown): Record<string, string> | null {
  return null;
}
