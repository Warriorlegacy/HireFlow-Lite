# HireFlow Lite — Production-Ready Master Build Prompt

**Product:** Privacy-conscious applicant tracking for startups and boutique recruiters  
**Use:** Paste this entire prompt into your AI coding agent with the target repository/workspace open.

# Production Build Contract — applies to this entire prompt

You are an autonomous senior product engineering team. Build the real product described below—not a static mockup, nonfunctional prototype, or collection of disconnected UI screens. Act as product manager, principal architect, UX designer, frontend/backend engineer, database engineer, security engineer, QA engineer, DevOps engineer, and technical writer. Use subagents only when the environment supports them and parallel work can be coordinated safely.

## Mandatory execution rules

1. **Inspect before changing.** Inspect the current workspace, Git status, branch, package manifests, existing code, schemas, migrations, auth, tests, deployment configuration, and documentation. Preserve useful working code. If an existing repo is supplied, treat it as the source of truth; do not replace it with a new scaffold without a documented reason.
2. **Resolve uncertainty intelligently.** Research current official documentation and relevant open-source implementations. Make reasonable assumptions for nonessential missing details and record them in `docs/ASSUMPTIONS.md`. Ask only when a decision is genuinely blocking or could cause irreversible cost, data loss, legal exposure, or security risk.
3. **Validate demand, not just code.** Keep product assumptions separate from verified facts. Build a narrow first release for the named buyer. Do not add features merely to inflate scope. Use synthetic data until the owner explicitly authorizes real customer data.
4. **Free-first, not free-at-any-cost.** Default to a $0 initial infrastructure plan, but verify current limits, eligibility, commercial terms, data use, request quotas, storage quotas, payment requirements, and regional availability before selecting any provider. Never enable paid resources, paid upgrades, usage-based billing, or a payment method without explicit authorization. Create `docs/FREE_STACK_AUDIT.md` with provider, exact plan, checked date, links, limits, assumptions, and fallback. Treat free tiers as quotas, not unlimited production capacity.
5. **Use a coherent default stack unless requirements justify another choice:** React + TypeScript + Vite; Tailwind CSS + accessible shadcn/ui/Radix primitives; Cloudflare Workers with Hono for server APIs; Cloudflare D1 + Drizzle ORM for relational data; Cloudflare R2 only for actual file storage; Better Auth only after verifying current Workers/D1 compatibility and configuration; Workers Static Assets for hosting the app and API together; Vitest for unit/integration tests; Playwright for browser journeys; Zod for validation; GitHub for version control and CI. Use PWA capabilities where stated. If the stack is a poor fit, explain the trade-off and select a currently supported free-tier alternative.
6. **No vendor lock-in by accident.** Isolate email, AI, payments, analytics, calendar, file storage, and third-party APIs behind adapters. The core product must remain useful if optional providers are unconfigured or hit quota.
7. **No fake integrations.** Never present mock data as live data, simulate successful payments, fabricate AI output, claim a message was sent when it was not, or claim a deployment succeeded without checking it. Clearly label demo/synthetic data. When keys or approvals are unavailable, finish the interface and adapter contract, provide a truthful disabled/configuration state, and document exact setup steps.
8. **Security is server-enforced.** Validate every input on the server. Authenticate and authorize every protected operation. Scope every tenant-owned query by the verified session and membership; never trust tenant/user IDs from the browser. Use least privilege, parameterized queries, secure cookie/session configuration, CSRF protections as appropriate, rate limits, security headers, safe file handling, audit events for sensitive actions, and secret management. Do not put secrets in client bundles or Git.
9. **Production-quality UX.** Provide responsive layouts, accessible semantics and keyboard operation, consistent design tokens, useful empty/loading/error/success states, confirmation for destructive actions, form validation, optimistic UI only when rollback is safe, and clear user-facing recovery messages. Avoid generic AI-template visuals and meaningless charts.
10. **Do not silently delete data.** Use migrations, backups/export strategy, soft deletion only where appropriate, retention policies, and explicit destructive-action confirmation. Never run destructive production migrations without a backup and a reviewed plan.
11. **Make quality measurable.** Run formatting, lint, typecheck, tests, migration checks, production build, and end-to-end flows. Fix defects and rerun. Do not disable a failing test to get a green build. Maintain a defect list and mark unresolved issues honestly.
12. **Document continuity.** Maintain `SESSION_CONTEXT.md` at root. Read it at the start of each session; update it after major milestones and before stopping, recording verified state, architecture, commands, env vars, migrations, tests, deployment status, known issues, and exact next tasks.

## Required project artifacts

Create/update at minimum:

- `README.md` — what the product does, local setup, scripts, architecture snapshot, demo instructions.
- `SESSION_CONTEXT.md` — current verified state and handoff for the next agent.
- `docs/PRD.md` — target user, problem, workflows, scope, non-goals, success metrics.
- `docs/ARCHITECTURE.md` — component boundaries, data flow, trust boundaries, deployment diagram (Mermaid is fine).
- `docs/DATA_DICTIONARY.md` — tables, fields, relationships, ownership, retention.
- `docs/API.md` — routes, auth, validation, response/error conventions.
- `docs/SECURITY_AND_PRIVACY.md` — threat model, roles, data classification, retention, safeguards, limitations.
- `docs/FREE_STACK_AUDIT.md` — verified free plans and usage limits as checked during implementation.
- `docs/TEST_PLAN.md` and `docs/TEST_RESULTS.md` — scenarios, executed commands, pass/fail, known gaps.
- `docs/DEPLOYMENT.md` and `.env.example` — configuration and deployment/runbook. `.env.example` must contain placeholders only.
- `CHANGELOG.md` — meaningful shipped changes.

## Default free-first infrastructure guardrails

Use Cloudflare Workers Free / Workers Static Assets, D1 Free and R2 Free allocation only after verifying current official documentation. Current documentation checked for this prompt set on **12 November 2026** indicates (recheck before deployment): Workers Free has a 100,000-request/day account limit and a 10 ms CPU-time limit per request; D1 Free has 10 databases, 500 MB per database, 5 GB account storage and query limits; R2 Standard Free allocation includes 10 GB-month storage, 1 million Class A operations and 10 million Class B operations monthly; static asset requests have separate billing/limits from Worker invocations. These limits can change and are not a promise of unlimited free production hosting. Static asset requests may be free/unlimited under Workers Static Assets, but dynamic Worker requests remain quota-bound.

Official references to re-check:
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers Static Assets billing/limits: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- R2 pricing/free allocation: https://developers.cloudflare.com/r2/pricing/
- Better Auth Cloudflare guide: https://better-auth.com/docs/guides/cloudflare
- Gemini API pricing/data terms: https://ai.google.dev/gemini-api/docs/pricing
- Resend pricing: https://resend.com/pricing

For optional email, AI, billing, analytics, OAuth and calendar providers, verify current restrictions before enabling. Core workflows must work without them. Do not send confidential customer data to free AI endpoints without explicit opt-in and a documented provider data policy. Never claim free tiers will remain free indefinitely.

## Required delivery sequence

A. Reconnaissance and product assumptions → B. PRD and architecture → C. data model and migrations → D. design system and responsive shell → E. auth/tenancy/permissions → F. core workflow end-to-end → G. reporting/automation/integrations → H. security review → I. automated QA → J. production build/deploy → K. live smoke test → L. documentation and handoff.

At each phase, keep the application runnable. Prefer vertical slices (UI + API + DB + tests) over building all frontend first and leaving backend disconnected.

## Definition of done

The product is not complete until the core buyer journey works end-to-end against a real database; authorization and tenant isolation tests pass; inputs are validated; error/loading/empty states exist; responsive layouts work; migrations and production build succeed; automated tests are executed; a production deployment is genuinely verified when credentials are available; documentation and `SESSION_CONTEXT.md` are updated; and every unconfigured integration or unresolved risk is disclosed in the final report.


---

## 1. Product mandate

Build **HireFlow Lite**, a lightweight applicant tracking system for small teams and boutique recruiting agencies. Help recruiters publish roles, capture applications, move candidates through a transparent pipeline, coordinate interviews, collect structured human feedback and communicate status consistently.

**Primary buyer:** startups and small businesses hiring a few roles at a time, or boutique recruiters managing a modest number of open roles.

**Core promise:** every application has a stage, owner, next step and accountable decision history.

**Differentiation:** fast setup, clean candidate communication, accessible pipeline and privacy-conscious workflow—not enterprise HRIS or automated candidate scoring.

## 2. Roles and privacy boundaries

Roles: workspace owner/admin, recruiter, hiring manager, interviewer, candidate/applicant. Job-level permission assignment is required.

- Owner/admin: workspace/team and retention settings.
- Recruiter: manage assigned jobs and candidates, communications, stage transitions.
- Hiring manager: view assigned job candidates, provide feedback and record decision where permitted.
- Interviewer: only assigned interview packet/scorecard, minimal candidate fields; cannot access unrelated applications or compensation notes unless granted.
- Candidate: own application status, submitted information and messages only.
- All access must be server-enforced by organization + job + application permissions.

Collect only role-relevant information. Avoid optional demographic fields by default. Never infer or store protected/sensitive traits for selection.

## 3. Core workflows

### Workspace and hiring team

Create workspace, invite recruiter/hiring manager/interviewers, configure job stages, email templates, retention rules and privacy notice. Each job has its own hiring team, scorecard rubric, public visibility and application fields.

### Job requisitions and public careers pages

Create job with title, department, location/remote status, employment type, salary range optional, description, required qualifications, application deadline, hiring owner, hiring team, published state and privacy notice version. Provide a public careers page and job detail pages with accessible application form. Draft jobs must not be indexed or publicly accessible. Expired/closed jobs must stop accepting applications unless reopened.

### Candidate application

Candidate submits name, email, contact number optional, resume/CV (private file), portfolio URL optional, relevant role questions and explicit consent/acknowledgment. Confirm submission and provide secure candidate status link or candidate account. Prevent duplicate application to same job with transparent merge/reapply rules; never silently merge two people solely by matching a name. Add rate limiting, spam protection, email verification as configured and upload restrictions.

### Recruiter pipeline

Stages configurable, suggested default: New → Screening → Interview → Assessment → Offer → Hired / Rejected / Withdrawn. Use kanban plus accessible list view. Every stage change records from/to, user, timestamp and reason where relevant. Allow bulk actions only with preview and confirmation. Stage ageing and next-action reminders should derive from real event data.

### Interviews and feedback

Schedule interview with start/end time, timezone, format, interviewer(s), private meeting link and candidate-facing details. Support reschedule/cancel with notifications only when provider is configured. Use structured scorecards tied to job rubric: competency, anchored rating scale, evidence/notes and recommendation. Make feedback private to hiring team. Candidate does not see internal feedback. Require human review; AI must never make a hiring decision.

### Candidate communications

Approved email templates for acknowledgement, invitation, reschedule, status update, offer follow-up and closure. Preview before send; log provider state accurately. Avoid unsolicited or bulk campaign tools. Support candidate opt-out/preferences where appropriate. Do not claim sent/delivered without provider response/webhook. In-app activity can be logged separately from external delivery.

### Job analytics

Applications by source, stage conversion, time in stage, time-to-first-review, time-to-fill only where timestamps support it, interview outcomes and workload. Show denominators and date ranges. Do not present AI or demographic fairness claims without validated methodology. Keep source tracking optional and transparent.

### Import/export and retention

CSV import with preview, duplicate suggestions and safe mapping. Export by role/job permission. Candidate requests for correction/deletion/withdrawal must be recorded and handled under configured retention policy. Support per-job archive and workspace-level retention. Explain backups and deletion propagation honestly.

## 4. AI governance (optional, off by default)

Do not build automated candidate ranking, automatic rejection, emotion/personality analysis, facial analysis, voice analysis, protected-trait inference or eligibility decisions. If a later AI helper is enabled, limit it to assistive tasks such as extracting job-related factual experience or drafting a recruiter summary. It must:
- be explicitly enabled by an authorized admin and disclosed in candidate/privacy notices where required;
- send minimum necessary data to a provider whose terms/data use have been reviewed;
- avoid age, gender, ethnicity, nationality, religion, disability, health, family status and other protected or sensitive trait inferences;
- show source text/section for extracted facts, uncertainty and missing information;
- require human confirmation and never determine stage/rejection/offer automatically;
- provide a non-AI workflow that is fully functional.

## 5. Data model

Tables: `organizations`, `memberships`, `job_roles`, `job_memberships`, `jobs`, `job_versions`, `application_forms`, `form_fields`, `candidates`, `candidate_consents`, `applications`, `application_answers`, `resume_files`, `pipeline_stages`, `stage_events`, `interviews`, `interview_participants`, `scorecard_templates`, `scorecards`, `scorecard_responses`, `feedback`, `communication_templates`, `communication_events`, `candidate_portal_tokens`, `source_attributions`, `retention_rules`, `deletion_requests`, `audit_events`, `usage_limits`.

Separate candidate identity from job application. Avoid unnecessary demographic columns. Keep resume binaries in private R2 and file metadata in D1. Use job-level access relation checks, indexes for org/job/stage/created date and retention timestamp. Store consent purpose, notice version, timestamp, source and withdrawal event.

## 6. UI and pages

Public careers landing/job detail/application; recruiter dashboard; job list/detail/editor; pipeline board/list; candidate profile/application detail; resume view/download (secure); interview calendar/list; interview packet and scorecard; hiring team; email template editor; candidate status portal; analytics; import/export; retention/privacy settings; role management; audit log. Include accessible drag-drop alternatives, robust search/filter/pagination and clear empty/loading/error states. Use synthesized resume fixtures only in demo.

## 7. Security and operational controls

Threats: candidate PII leakage; cross-tenant/job IDOR; public resume exposure; insecure invite/token links; unauthorized interviewer access; malicious resume upload; CSV formula injection; mass export; stale candidate portal tokens; AI overreach; email mis-send. Implement server-side permissions, private R2, short-lived signed URLs, file allowlists/signature validation/size caps, hashed expiring portal tokens, audit logs, rate limits, CSP, secure sessions, CSRF protections where appropriate, export permissions, deletion controls and no PII in logs. Candidate status token must not expose resume or internal feedback.

## 8. Integrations and monetization

Core app should function without paid email, calendar or AI. Provide ICS calendar downloads first. Optional calendar OAuth requires verified scopes/refresh/revocation. Email provider adapter must be quota-aware and accurate. Do not integrate job board scraping or auto-apply bots. Pricing hypotheses: ₹999/month for a small internal hiring team, ₹2,499/month for recruiter workspace; validate with pilot customers before billing automation. Plan limits may be active jobs, team seats and monthly applications, but only after real buyer interviews.

## 9. Acceptance tests

- Interviewer only sees assigned interview packets and allowed candidate fields.
- Candidate portal can access only own application and cannot enumerate IDs.
- Resume links are private, short-lived and revoked after access policy changes.
- Upload rejects unsafe MIME/type/size and stores object under generated key.
- Duplicate detection suggests review; does not silently combine identities.
- Stage transitions create immutable history and enforce configured rules.
- Scorecards are private and attached to correct job/interview.
- Candidate communication state reflects provider truth; retry is idempotent.
- Candidate consent/withdrawal and deletion request are auditable.
- Retention job deletes/anonymizes according to policy and handles R2 objects.
- Analytics match fixture data and show correct denominators.
- AI is off by default; no automated rejection/ranking path exists.

## 10. Delivery sequence

Ship: job creation/public listing → application form + secure resume upload → recruiter candidate list/profile → pipeline/stage history → interview scheduling + scorecard → candidate communication templates → analytics/retention. Add calendar/email connectors only after the base workflow is tested. Use synthetic candidate profiles and generated sample resumes with no real personal data. Before production, complete privacy/security review and define deletion/retention defaults. Final report must state whether email, calendar and AI features are actually configured and confirm there is no automated candidate decision-making.

---

## Final response format required from the coding agent

Return a concise but evidence-based handoff with: (1) production URL and verification timestamp or explicit reason not deployed; (2) repository and commit; (3) implemented workflows; (4) database migrations; (5) test commands and real pass/fail counts; (6) security checks and outstanding risks; (7) free-tier providers and quotas rechecked; (8) unconfigured integrations; (9) known bugs/limitations; (10) exact next steps. Link to evidence such as test logs, screenshots, API docs and deployment runbook. Do not claim success where evidence is absent.
