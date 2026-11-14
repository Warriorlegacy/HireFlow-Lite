# Security & Privacy — HireFlow Lite

## Authentication
- PBKDF2 (100k iterations) password hashing; no plaintext storage.
- Server-side sessions in D1; cookie `HttpOnly; Secure; SameSite=Lax`.
- CSRF double-submit cookie + `X-CSRF-Token` header on all state-changing requests.
- Rate limiting on login and public apply endpoints.

## Authorization
- Tenant isolation: every query filters by `organization_id = auth.org.id`.
- Job-level access: non-admins see only jobs they own or are members of (`job_memberships`).
- Role-based: owner, recruiter, hiring_manager, interviewer, admin with distinct capabilities.
- Resume downloads blocked for interviewers (`access.level === 'interview'` → 403).
- Exports gated by `canExport` (recruiter/admin).
- Candidate portal token scoped to a single application; no ID enumeration.

## Data protection
- Resumes validated by magic bytes (PDF/DOCX), size ≤5MB, stored under generated keys.
- Resume downloads are authenticated, audited, `no-store, private`, `nosniff`.
- No PII in application logs; resume bytes never logged.
- Candidate consent recorded with timestamp; withdrawal supported.
- Data requests (access/rectify/delete) tracked and resolvable by admins.
- Retention policy with scheduled run; anonymise/delete per org config.

## Audit integrity
- `audit_log` is a hash chain (prev_hash → hash); `/audit/verify` detects tampering.
- Resume downloads, stage moves, exports, privacy actions all audited with client IP.

## Secrets
- No secrets in repo; `.env`/`.dev.vars` gitignored.
- `RESEND_API_KEY`, `AI` keys set via Cloudflare secrets/env, never committed.
- Demo mode gated behind `DEMO_SECRET` when configured.

## AI
- `AI_ENABLED=false` by default. No automated rejection, ranking, or scoring of candidates. Any AI use is assistive and logged.

## Known limitations
- R2 disabled in current deploy → D1 blob fallback for resumes (size limits apply).
- `ALLOW_DEMO=true` in production for pilot; disable before real candidate data.