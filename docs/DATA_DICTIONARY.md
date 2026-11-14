# Data Dictionary — HireFlow Lite

Primary schema: `server/migrations/0001_initial_schema.sql` (31 tables). All tables include `organization_id` for tenant isolation unless noted.

## Core entities

- **organizations** — tenant root (name, slug, settings, privacy notice URL, retention days).
- **users** — accounts (email, password hash, role, org, status).
- **sessions** — server-side sessions (token hash, expiry, CSRF).
- **team_invites** — invite tokens with role and expiry.
- **jobs** — roles (title, slug, status, department, location, work mode, salary, owner, published_at).
- **job_memberships** — user↔job access grants.
- **pipeline_stages** — per-job stages (name, order, color, terminal flag).
- **candidates** — people (name, email, phone, location, consent flags).
- **applications** — candidate↔job (stage, status, source, owner, applied_at, first_reviewed_at).
- **application_answers** — answers to job questions.
- **application_stage_history** — immutable stage transition log.
- **resume_files** — resume metadata (filename, mime, size, storage_backend, storage_key, deleted_at).
- **file_blobs** — D1 fallback storage for resume bytes (base64).
- **interviews** — scheduling (start/end, meeting URL, status).
- **interview_panel** — interviewer assignments.
- **scorecard_templates** / **scorecard_items** — per-job rubrics.
- **scorecards** / **scorecard_responses** — submitted evaluations (private per interview).
- **communications** — logged messages (channel, to, subject, body, provider status).
- **communication_templates** — reusable templates.
- **audit_log** — hash-chained audit events.
- **candidate_portal_tokens** — opaque portal access tokens.
- **candidate_consent** — consent/withdrawal records.
- **data_requests** — candidate data requests (access/rectify/delete).
- **retention_policies** — per-org retention config.
- **analytics_events** — event log for funnel analytics.
- **rate_limits** — rate limit buckets.

## Privacy columns

- `candidates.consent_given_at`, `consent_withdrawn_at`
- `resume_files.deleted_at` (soft delete)
- `applications.deleted_at` / anonymised fields on retention

## Notes

- No PII in logs; resume bytes never logged.
- All timestamps are epoch millis (INTEGER).