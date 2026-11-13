# Deployment

## Production

- Worker: `hireflow-lite`
- URL: https://hireflow-lite.rajpiyush092.workers.dev
- Version ID: 934e3076-ceed-4853-9925-b0f7847f1737
- D1: `hireflow-db` (5fbfa9d3-fff0-4543-aa8f-ed4a0464e91d)

## Steps

1. `npm run db:remote` — apply schema
2. `npm run seed:remote` — seed demo data
3. `npm run build`
4. `npx wrangler deploy`
5. `node scripts/smoke.mjs https://hireflow-lite.rajpiyush092.workers.dev`

## Secrets (optional)

- `RESEND_API_KEY`, `EMAIL_FROM` — email
- `GEMINI_API_KEY` — AI helper
- Set via `wrangler secret put` or Sites secrets.