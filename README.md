# HireFlow Lite

> Privacy-conscious applicant tracking for startups and boutique recruiters. Publish roles, collect applications, run a readable pipeline, and leave a record of every decision. No automated ranking or rejection.

Live Production URL: **[https://hireflow-lite.rajpiyush092.workers.dev](https://hireflow-lite.rajpiyush092.workers.dev)**  
Infrastructure: **Cloudflare Workers + Cloudflare D1 + Workers Static Assets** ($0/month Free Tier)  
Design Standard: **Unslop Editorial / Fieldnote** (Paper `#f7f5f0`, Ink `#1a1917`, Accent `#2f5d50`)

---

## Features

- **Public careers pages** with accessible application forms, resume upload (private), consent capture.
- **Configurable pipeline** with append-only stage history (who, when, why).
- **Job-level hiring team** permissions: owner, admin, recruiter, hiring manager, interviewer.
- **Interview scheduling** with ICS download, reschedule/cancel, reduced interviewer packets.
- **Structured scorecards** with anchored 1–5 ratings and human recommendation (no AI decisions).
- **Candidate status portal** with expiring hashed token, withdrawal, consent withdrawal, data requests.
- **CSV import** with preview and duplicate suggestions; **CSV export** with formula escaping.
- **Retention rules** that anonymise expired records via scheduled cron.
- **Audit log** with hash chain for sensitive actions.
- **AI and email off by default**; adapters present but disabled until configured.

---

## Demo Accounts

Pre-seeded credentials (password for all accounts: `DemoPass123!` or use the 1-click persona switcher):

| Persona | Email | Role |
|---|---|---|
| Ananya Rao | `owner@hireflow.demo` | Owner |
| Priya Nair | `recruiter@hireflow.demo` | Recruiter |
| Daniel Cho | `manager@hireflow.demo` | Hiring manager |
| Sofia Lind | `interviewer@hireflow.demo` | Interviewer |
| Marcus Bell | `admin@hireflow.demo` | Admin |

---

## Tech Stack & Free-Tier Architecture

- **Backend:** Hono v4 on Cloudflare Workers
- **Database:** Cloudflare D1 (Serverless SQLite, APAC region)
- **Frontend:** React 18, React Router DOM v6, Lucide React, Tailwind CSS
- **Cryptography:** Native Web Crypto API (PBKDF2, SHA-256)
- **File storage:** D1 blob fallback (R2 not enabled on this account)
- **Hosting Cost:** $0.00 / month (within Cloudflare Free Tier quotas)

---

## Local Development

```bash
npm install
npm run db:local        # apply schema to local D1
npm run seed:local      # seed synthetic demo data
npm run dev             # Vite dev server on :5175
npm run dev:worker      # Wrangler dev on :8789 (proxy target)
```

## Checks

```bash
npm run typecheck       # tsc --noEmit
npm run test            # vitest run (8 tests)
npm run build           # vite build → public/
npm run smoke           # node scripts/smoke.mjs <url>
```

## Deployment

```bash
npm run db:remote       # apply schema to remote D1
npm run seed:remote     # seed remote demo data
npm run build
npx wrangler deploy
node scripts/smoke.mjs https://hireflow-lite.rajpiyush092.workers.dev
```

## Documentation

See `docs/` for PRD, architecture, data dictionary, API, security, free-stack audit, test plan/results, deployment, assumptions, changelog.  
See `SESSION_CONTEXT.md` for verified handoff state.