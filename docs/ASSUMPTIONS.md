# Assumptions

- R2 not enabled on the Cloudflare account → resume storage uses the private D1 blob fallback (`file_blobs` table). Switch to R2 by enabling it and creating bucket `hireflow-resumes`, then uncommenting `r2_buckets` in wrangler.jsonc.
- AI and email are optional and off by default (`AI_ENABLED=false`, no `RESEND_API_KEY`). Adapters present with truthful disabled state.
- Demo accounts enabled in production (`ALLOW_DEMO=true`) for pilot; must be disabled before real customer data.
- Single-organization-per-user membership (first active membership used). Multi-org switching not in MVP.
- Retention cron runs daily via Workers scheduled trigger (configured in wrangler).
- No git repository; version control optional.