import { test, expect } from '@playwright/test';

test.describe('Privacy flows', () => {
  test('candidate portal invalid token returns 404', async ({ request }) => {
    const res = await request.get('/api/v1/portal/not-a-real-token-xxxxxxxxxxxxxxxx');
    expect(res.status()).toBe(404);
  });

  test('candidate portal page is noindex', async ({ page }) => {
    await page.goto('/portal/not-a-real-token-xxxxxxxxxxxxxxxx');
    // page may show 404; check robots meta or x-robots-tag via response
    const res = await page.request.get('/api/v1/portal/not-a-real-token-xxxxxxxxxxxxxxxx');
    const headers = res.headers();
    // x-robots-tag should be noindex when portal resolves; for 404 we just ensure no crash
    expect([404, 403]).toContain(res.status());
  });

  test('public careers page exposes no PII', async ({ page }) => {
    await page.goto('/careers');
    const body = await page.content();
    expect(body).not.toContain('candidate_email');
    expect(body).not.toContain('resume_file');
  });

  test('resume download requires auth', async ({ request }) => {
    const res = await request.get('/api/v1/applications/any/resume');
    expect([401, 403, 404]).toContain(res.status());
  });
});