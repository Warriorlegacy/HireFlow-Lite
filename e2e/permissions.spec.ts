import { test, expect } from '@playwright/test';

test.describe('Permission flows', () => {
  test('interviewer cannot access audit log UI route', async ({ page }) => {
    await page.goto('/login');
    // demo switch via API
    await page.request.post('/api/v1/auth/demo-switch', {
      data: { email: 'interviewer@hireflow.demo' },
    });
    const res = await page.goto('/audit');
    // Either redirect to login or 403-ish; ensure audit content not shown
    const body = await page.content();
    expect(body).not.toContain('Audit log entries');
  });

  test('protected routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('interviewer blocked from applications API', async ({ request }) => {
    const login = await request.post('/api/v1/auth/demo-switch', {
      data: { email: 'interviewer@hireflow.demo' },
    });
    expect(login.ok()).toBeTruthy();
    const cookies = login.headers()['set-cookie'];
    const res = await request.get('/api/v1/applications', {
      headers: { Cookie: cookies?.split(';')[0] || '' },
    });
    expect(res.status()).toBe(403);
  });
});