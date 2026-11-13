# Free Stack Audit

Checked 2026-11-14.

| Provider | Plan | Purpose | Limits | Notes |
|---|---|---|---|---|
| Cloudflare Workers | Free | Host Worker + static assets | 100k req/day, 10ms CPU | Static asset requests billed separately |
| Cloudflare D1 | Free | Relational DB | 10 DBs, 500MB/DB, 5GB account | hireflow-db single DB |
| Cloudflare Workers Static Assets | Free | SPA hosting | per static asset limits | 10 files uploaded |
| Resend (optional) | Free | Email | 3k emails/mo, 100/day | Not configured |
| Gemini (optional) | Free tier | AI helper | per model quotas | Not configured, AI off |

R2 not used (not enabled on account); D1 blob fallback used instead. No payment method required for current stack.