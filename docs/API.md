# API Reference — HireFlow Lite

Base path: `/api/v1`. All responses JSON unless noted. Authentication via session cookie. CSRF header `X-CSRF-Token` required on state-changing requests.

## Auth (`/auth`)
- `POST /login` — email+password → session.
- `POST /logout` — destroy session.
- `POST /change-password`
- `POST /demo-switch` — switch persona (gated by `ALLOW_DEMO`/`DEMO_SECRET`).
- `GET /me` — current user + org.

## Jobs (`/jobs`)
- `GET /` list (scoped), `POST /` create, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- `PUT /:id/stages`, `PUT /:id/scorecard`, `POST /:id/team`
- `POST /:id/status` publish/archive
- `GET /templates`, `PUT /templates/:key`

## Applications (`/applications`)
- `GET /` list (scoped), `GET /:id` detail, `PATCH /:id`, `DELETE /:id`
- `POST /:id/stage` move stage, `POST /:id/status`
- `POST /:id/feedback`, `POST /:id/scorecard`, `GET /:id/resume`, `GET /:id/export`
- `POST /:id/portal-link`, `POST /:id/portal-link/revoke`

## Pipeline (`/pipeline` via jobs/applications)
- Stage history recorded on every move.

## Interviews (`/interviews`)
- `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- `POST /:id/feedback`, `GET /:id/calendar.ics`

## Communications (`/communications`)
- `GET /`, `POST /send`, `GET /templates`

## Dashboard (`/dashboard`)
- `GET /` summary metrics.

## Analytics (`/analytics`)
- `GET /` funnel, time-to-hire, sources.

## Audit (`/audit`)
- `GET /` list (admin), `GET /verify` hash-chain check.

## Team (`/team`)
- `GET /`, `POST /invite`, `POST /accept-invite`, `PATCH /members/:userId`, `DELETE /members/:userId`, `POST /invite/:id/revoke`

## Settings (`/settings`)
- `GET /`, `PATCH /` org settings, retention, privacy notice.

## Privacy (`/privacy`)
- `GET /requests`, `POST /requests/:id/resolve`, `POST /retention/preview`, `POST /retention/run`, `PUT /retention`.

## Import/Export (`/import-export`)
- `GET /export` CSV, `POST /import/preview`, `POST /import/commit`.

## Portal (`/portal`)
- `GET /:token`, `POST /:token/withdraw`, `POST /:token/consent-withdraw`, `POST /:token/data-request`, `GET /:token/calendar.ics`

## Public (`/public`)
- `GET /organizations/:slug`, `GET /organizations/:slug/jobs/:jobSlug`
- `POST /organizations/:slug/jobs/:jobSlug/apply`
- `GET /careers`, `GET /careers/:jobSlug`, `POST /careers/:jobSlug/apply`
- `GET /jobs` (feed)

## Error format

```json
{ "error": { "code": "FORBIDDEN", "message": "..." } }
```

HTTP status reflects the error (400/401/403/404/409/422/429/500).