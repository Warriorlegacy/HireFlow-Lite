# Test Plan — HireFlow Lite

## Automated

### Unit / API (Vitest) — `tests/api.test.ts` (8 tests)
- Health endpoint.
- Login success/failure, CSRF enforcement.
- Job creation + listing scoped by role.
- Role isolation (interviewer cannot create jobs).
- Application creation + portal token issuance.
- Public careers listing.

### E2E (Playwright) — `e2e/` (7 tests)
- `permissions.spec.ts`: unauth redirect; interviewer blocked from audit UI and applications API.
- `privacy.spec.ts`: portal invalid token 404; careers page no PII; resume download requires auth.

### Live smoke — `scripts/smoke.mjs` (32 checks)
- Runs against deployed Worker; covers auth, jobs, applications, pipeline, portal, privacy, audit, analytics.

## Manual verification checklist
- Sign in as each demo role; confirm nav visibility matches role.
- Apply via public careers page with PDF and DOCX; verify validation rejects bad types.
- Move application through stages; verify history recorded.
- Schedule interview; download ICS; submit scorecard as interviewer.
- Send templated communication; verify `not_configured` state when no provider.
- Candidate portal: withdraw consent, submit data request.
- Run retention preview; verify counts.
- Verify audit chain (`/audit/verify`).

## Non-goals
- No load/perf testing (free tier).
- No visual regression testing.