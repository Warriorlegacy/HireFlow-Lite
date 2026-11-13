import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../../server/app';
import { makeTestD1, type TestD1 } from './d1';

export interface TestClient {
  cookie: string;
  csrf: string;
  request: (
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      noCsrf?: boolean;
    },
  ) => Promise<{ status: number; body: any; headers: Headers }>;
}

export async function makeHarness(loadSeed = true) {
  const d1: TestD1 = await makeTestD1();

  if (loadSeed) {
    const seed = fs.readFileSync(path.resolve('server/seed.sql'), 'utf8');
    d1._raw.run(seed);
  }

  const app = createApp();
  const env = { DB: d1, ENVIRONMENT: 'test', ALLOW_DEMO: 'true' } as any;

  function makeClient(): TestClient {
    const state = { cookie: '', csrf: '' };
    const client: TestClient = {
      get cookie() { return state.cookie; },
      set cookie(v: string) { state.cookie = v; },
      get csrf() { return state.csrf; },
      set csrf(v: string) { state.csrf = v; },
      async request(path, options = {}) {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          origin: 'http://localhost',
          ...(state.cookie ? { cookie: state.cookie } : {}),
          ...(state.csrf && !options.noCsrf ? { 'x-csrf-token': state.csrf } : {}),
          ...(options.headers || {}),
        };
        const url = path.startsWith('/api/') ? `http://localhost${path}` : `http://localhost/api/v1${path}`;
        const res = await app.fetch(
          new Request(url, {
            method: options.method || 'GET',
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
          }),
          env,
          { waitUntil() {}, passThroughOnException() {} } as any,
        );
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) state.cookie = setCookie.split(';')[0];
        const text = await res.text();
        let body: any = text;
        try { body = JSON.parse(text); } catch { /* keep */ }
        if (body?.csrf_token) state.csrf = body.csrf_token;
        return { status: res.status, body, headers: res.headers };
      },
    };
    return client;
  }

  return { d1, app, env, newClient: makeClient };
}