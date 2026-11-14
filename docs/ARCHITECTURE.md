# Architecture — HireFlow Lite

## Stack

- **Frontend:** React 18 + Vite + Tailwind + React Router, built to `public/` (static assets).
- **Backend:** Hono on Cloudflare Workers (ES module), TypeScript.
- **Database:** Cloudflare D1 (SQLite) via `server/db.ts` wrapper.
- **Files:** Cloudflare R2 when `env.FILES` present; otherwise D1 `file_blobs` fallback (base64).
- **Auth:** PBKDF2 + session table; CSRF double-submit.
- **Email:** Resend adapter (optional, off by default).
- **AI:** none wired into decisions; off by default.

## Request flow

1. Static assets served by `env.ASSETS` (Cloudflare).
2. `/api/v1/*` handled by Hono router (`server/app.ts`), wrapped with auth middleware, CSRF check, rate limit.
3. DB access via `c.get('db')` (D1 binding `env.DB`).
4. File read/write via `env.FILES` (R2) or D1 fallback.

## Module layout

```
server/
  index.ts          Worker entry
  app.ts            Hono app + middleware + route mounting
  app-env.ts        Env typing
  auth.ts           session, CSRF, demo-switch, rate limit
  crypto.ts         PBKDF2, tokens, ids
  db.ts             D1 wrapper
  permissions.ts    RBAC helpers
  files.ts          resume validation/storage
  email.ts          Resend adapter
  hashchain.ts      audit hash chain
  csv.ts            CSV parse/serialize
  retention.ts      retention policy execution
  routes/           one router per domain
  migrations/       D1 SQL migrations
src/                React frontend
static/             public static assets, headers, manifest
```

## Multi-tenancy

Every table carries `organization_id`. Queries always filter by `auth.org.id`. Job-level access enforced via `jobAccess()` (owner + `job_memberships`). Non-admins see only jobs they own or are members of.

## Audit integrity

`audit_log` rows form a hash chain (prev_hash → hash). `/api/v1/audit/verify` recomputes and reports mismatches. Audit writes are best-effort but never block the request.

## Deployment

`wrangler deploy` uploads the Worker + static assets. D1 migrations applied via `wrangler d1 migrations apply`. See `docs/DEPLOYMENT.md`.