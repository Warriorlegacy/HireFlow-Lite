# Product Requirements Document — HireFlow Lite

## 1. Product

HireFlow Lite is a privacy-conscious applicant tracking system (ATS) for startups and boutique recruiters. It covers the full hiring lifecycle from public job posting through offer, with candidate privacy, tenant isolation, and auditable decisions as first-class concerns.

## 2. Target users

- **Workspace admins / recruiters (hiring team)** — manage jobs, pipeline, interviews, scorecards, comms, analytics, imports/exports, privacy requests, retention.
- **Hiring managers** — own roles, review applications, move stages, approve offers.
- **Interviewers** — read-only interview packets, submit scorecards for assigned interviews.
- **Candidates** — public careers apply, candidate portal (token-based) for status, consent withdrawal, data requests.
- **Workspace admins (platform)** — team invites, settings, audit, retention policy.

## 3. Core workflows (implemented)

1. **Jobs** — create/edit/publish/archive, pipeline stages, scorecard templates, question bank, team assignments.
2. **Applications** — public apply with resume upload (PDF/DOCX ≤5MB, magic-byte validation), duplicate detection, status, owner, source.
3. **Pipeline** — stage moves with immutable history, reason, SLA first-review tracking, search/filter.
4. **Interviews** — scheduling, panel, ICS download, evidence, scorecards (private per interview).
5. **Communications** — templated email/in-app messages with provider truth (Resend optional), retry.
6. **Candidate portal** — token-based, status, consent withdraw, data request, withdrawal.
7. **Privacy** — anonymise/delete requests, audit hash chain, retention policy + scheduled run.
8. **Analytics** — funnel, time-to-hire, source effectiveness, pipeline health.
9. **Import/Export** — CSV export (role-scoped), CSV import with preview + duplicate detection.
10. **Audit** — hash-chained audit log, tamper detection endpoint.

## 4. Privacy & security requirements

- Tenant isolation by `organization_id` on every query.
- Job-level access (owner + memberships) for non-admins.
- Resume files stored under generated keys, never public; authenticated, audited downloads.
- Candidate portal tokens are opaque, single-purpose, revocable.
- CSRF on all state-changing requests (double-submit cookie + header).
- PBKDF2 password hashing (100k iterations), session cookies `HttpOnly; Secure; SameSite=Lax`.
- Rate limiting on login and public apply.
- AI off by default (`AI_ENABLED=false`); no automated rejection/ranking path.
- Demo mode gated behind `DEMO_SECRET` when configured.

## 5. Non-functional

- Free-tier Cloudflare stack (Workers + D1 + Static Assets); $0/month.
- PWA manifest + service worker cache for static assets.
- Responsive UI, keyboard-accessible forms.
- No third-party analytics by default.

## 6. Acceptance criteria (verified)

See `docs/TEST_PLAN.md` and `docs/TEST_RESULTS.md`. All 8 unit tests, 7 E2E tests, 32 live smoke checks pass.