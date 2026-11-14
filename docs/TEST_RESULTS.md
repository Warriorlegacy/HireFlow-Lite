# Test Results

## Commands

- `npm run typecheck` → 0 errors (2026-11-14)
- `npm run test` → 8/8 passed (2026-11-14)
- `npm run build` → success (public/, 447KB JS gz 118KB)
- `node scripts/smoke.mjs https://hireflow-lite.rajpiyush092.workers.dev` → 32/32 passed (2026-11-14)
- `npx playwright test` → 7/7 passed (2026-11-14) (privacy + permission flows)

## Test Files

- `tests/api.test.ts` — 8 tests (health, auth, CSRF, jobs, role isolation, portal, public careers)
- `e2e/permissions.spec.ts` — 3 tests (interviewer blocked from audit/applications, unauth redirect)
- `e2e/privacy.spec.ts` — 4 tests (portal 404, noindex, no PII, resume auth)

## Known Gaps

- No Playwright E2E suite yet.
- No load/perf testing.
- Resume upload/download not covered by automated tests.