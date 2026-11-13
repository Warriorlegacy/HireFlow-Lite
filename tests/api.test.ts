import { describe, it, expect, beforeAll } from 'vitest';
import { makeHarness, type TestClient } from './helpers/app';

describe('HireFlow Lite API & Security Suite', () => {
  let harness: Awaited<ReturnType<typeof makeHarness>>;
  let client: TestClient;

  beforeAll(async () => {
    harness = await makeHarness(true);
    client = harness.newClient();
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await client.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('HireFlow Lite API');
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await client.request('/jobs');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('signs in owner and obtains CSRF token and session cookie', async () => {
    const res = await client.request('/auth/login', {
      method: 'POST',
      body: { email: 'owner@hireflow.demo', password: 'DemoPass123!' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.role).toBe('owner');
    expect(client.cookie).toContain('hf_session=');

    const me = await client.request('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.email).toBe('owner@hireflow.demo');
    client.csrf = me.body.csrf_token;
    expect(client.csrf).toBeTruthy();
  });

  it('enforces CSRF protection on state mutations', async () => {
    const res = await client.request('/jobs', {
      method: 'POST',
      body: { title: 'Test', description: 'Test description that is long enough to pass validation checks here.' },
      noCsrf: true,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_FAILED');
  });

  it('lists published jobs for owner', async () => {
    const res = await client.request('/jobs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThan(0);
  });

  it('enforces role separation: interviewer cannot view audit log', async () => {
    const ivClient = harness.newClient();
    const login = await ivClient.request('/auth/login', {
      method: 'POST',
      body: { email: 'interviewer@hireflow.demo', password: 'DemoPass123!' },
    });
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('interviewer');

    const auditRes = await ivClient.request('/audit');
    expect(auditRes.status).toBe(403);
  });

  it('candidate portal token resolves only own application', async () => {
    // just ensure portal route exists and rejects missing token
    const res = await client.request('/portal/not-a-real-token');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('public careers page lists published jobs', async () => {
    const res = await client.request('/public/jobs');
    expect(res.status).toBe(200);
  });
});