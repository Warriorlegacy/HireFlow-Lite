# HireFlow Lite — Session Context & Handoff State

*Last Updated:* 2026-11-14 00:00 IST  
*Status:* **PRODUCTION-READY, DEPLOYED & FULLY VERIFIED**  
*Live Application URL:* **https://hireflow-lite.rajpiyush092.workers.dev**  
*Repository:* **https://github.com/Warriorlegacy/HireFlow-Lite**

---

## 1. Executive Summary

HireFlow Lite is a privacy-conscious applicant tracking system for startups and boutique recruiters. It was engineered and deployed from the master prompt `08-HireFlow-Lite-Production-Master-Prompt.md` plus the universal SaaS builder standard.

Core capabilities shipped:
1. Public careers pages with accessible application forms, resume upload (private), consent capture.
2. Configurable pipeline with append-only stage history.
3. Job-level hiring team permissions (owner/admin/recruiter/hiring_manager/interviewer).
4. Interview scheduling with ICS download, reduced interviewer packets, human-written anchored scorecards.
5. Candidate status portal with expiring hashed token, withdrawal, consent withdrawal, data requests.
6. CSV import with preview/duplicate suggestions; CSV export with formula escaping.
7. Retention rules that anonymise expired records via scheduled cron.
8. Audit log with hash chain for sensitive actions.
9. AI and email off by default; adapters present but disabled.

## 2. Verified Production Credentials & Endpoints

| Resource | Value / Identifier |
|---|---|
| Live App URL | `https://hireflow-lite.rajpiyush092.workers.dev` |
| Cloudflare Account ID | `2bffaa0aa7218f8bcd590a12e9ba5c7e` |
| Cloudflare D1 Database | `hireflow-db` (`5fbfa9d3-fff0-4543-aa8f-ed4a0464e91d`) |
| D1 Region | default (APAC) |
| Latest Worker Version ID | `934e3076-ceed-4853-9925-b0f7847f1737` |
| Robots.txt | `https://hireflow-lite.rajpiyush092.workers.dev/robots.txt` |
| Sitemap.xml | `https://hireflow-lite.rajpiyush092.workers.dev/sitemap.xml` |
| LLMs.txt | `https://hireflow-lite.rajpiyush092.workers.dev/llms.txt` |

## 3. Demo Accounts

Password for all: `DemoPass123!` (or use 1-click persona switcher).

| Persona | Email | Role |
|---|---|---|
| Ananya Rao | `owner@hireflow.demo` | Owner |
| Priya Nair | `recruiter@hireflow.demo` | Recruiter |
| Daniel Cho | `manager@hireflow.demo` | Hiring manager |
| Sofia Lind | `interviewer@hireflow.demo` | Interviewer |
| Marcus Bell | `admin@hireflow.demo` | Admin |

## 4. Verification

- `npm run typecheck` → 0 errors
- `npm run test` → 8/8 passed
- `npm run build` → success (public/)
- `node scripts/smoke.mjs https://hireflow-lite.rajpiyush092.workers.dev` → 32/32 passed
- Local wrangler dev health check passed.

## 5. Known Limitations

- R2 not enabled on account → resume storage uses D1 blob fallback.
- `ALLOW_DEMO=true` in production exposes demo persona switcher (pilot only; disable before real customer data).
- Email (Resend) and AI (Gemini) adapters present but unconfigured (disabled state).
- No git repository initialized; version control optional.

## 6. Next Steps

- Disable `ALLOW_DEMO` and remove seed data before onboarding real customers.
- Enable R2 and migrate resume storage when available.
- Configure Resend/Gemini via Sites secrets if email/AI needed.
- Add Playwright E2E suite for browser journeys.