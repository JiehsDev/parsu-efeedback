# Environment Variables Reference

Every variable the app needs, why it's needed, where to get the real value,
and which file/dashboard it goes in. `src/lib/env.ts` validates all of these
at import time — if one is missing or malformed, you'll get a clear error
listing exactly what's wrong instead of a mystery crash later.

## Local setup

```bash
cp .env.example .env.local
# fill in real values using the table below
npm run dev
```

`.env.local` is git-ignored (see `.gitignore`) — never commit it. Only
`.env.example` (no real values) is tracked.

For deployment (Cloudflare Pages / Vercel), the same names are set as
project environment variables in that platform's dashboard, scoped per
environment (Production / Preview) — see `docs/architecture.md` section 12.

## Secrets & connection strings

| Variable | Used for | Where to get it |
|---|---|---|
| `MONGODB_URI` | Mongoose connection string | Atlas dashboard → Database → **Connect** → Drivers. Use a separate M0 project for dev vs prod. |
| `AUTH_SECRET` | Signs/encrypts Auth.js JWTs | Generate locally: `npx auth secret` |
| `AUTH_URL` | Auth.js canonical app URL | `http://localhost:3000` locally; your deployed URL in prod |
| `R2_ACCOUNT_ID` | Cloudflare R2 (S3-compatible) client | Cloudflare dashboard → R2 → Overview (Account ID in the sidebar) |
| `R2_ACCESS_KEY_ID` | R2 client auth | Cloudflare dashboard → R2 → **Manage R2 API Tokens** → Create token |
| `R2_SECRET_ACCESS_KEY` | R2 client auth | Same token creation screen — shown once, copy immediately |
| `R2_BUCKET_NAME` | Target bucket for attachments | The bucket name you create under R2 → Buckets |
| `R2_PUBLIC_URL` | Public base URL for stored files | R2 bucket → Settings → Public access (custom domain or `r2.dev` subdomain) |
| `RESEND_API_KEY` | Sends transactional email | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender address | Must belong to a domain verified under resend.com → Domains |
| `UPSTASH_REDIS_REST_URL` | Rate limiting + cron trigger backend | console.upstash.com → Redis database → REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above | Same tab |
| `CRON_SECRET` | Shared secret `/api/cron/sla-check` checks on every hit | Generate any long random string, e.g. `openssl rand -hex 32` |

## App

| Variable | Used for | Notes |
|---|---|---|
| `NODE_ENV` | Standard Node environment flag | `development` \| `test` \| `production` — usually set automatically by the platform in prod |
| `NEXT_PUBLIC_APP_URL` | Client-visible base URL (emails, absolute links) | `NEXT_PUBLIC_*` vars are bundled into client JS — never put secrets here |

## Business-rule-driven thresholds

These aren't secrets — they're the configurable numbers business rules call
for. Full mapping (rule ID → variable → default → consuming phase) lives in
`docs/business-rules.md`; summary:

| Variable | Business rule | Default |
|---|---|---|
| `AUTH_MAX_FAILED_LOGIN_ATTEMPTS` | BR-013 | `5` |
| `AUTH_LOCKOUT_DURATION_MINUTES` | BR-013 | `15` |
| `AUTH_SESSION_MAX_AGE_MINUTES` | BR-087 | `60` |
| `UPLOAD_MAX_FILE_SIZE_MB` | BR-061 | `10` |
| `UPLOAD_ALLOWED_MIME_TYPES` | BR-060 | see `.env.example` |
| `TICKET_NUMBER_PREFIX` | BR-036, BR-100 | `PARSU` |

## Validation

All of the above are parsed by a single Zod schema in `src/lib/env.ts`.
Feature code imports `{ env }` from there — never `process.env` directly —
so:

- a missing secret fails immediately with a readable message instead of a
  `undefined` bug three functions deep,
- numeric thresholds arrive as actual `number`s (not strings), and
- `UPLOAD_ALLOWED_MIME_TYPES` arrives as a ready-to-use `string[]`.

`src/lib/env.ts` isn't consumed by any other module yet — that starts in
Phase 5 (`lib/db.ts` reads `MONGODB_URI`) and continues through Phase 6
(Auth.js secrets + BR-013/BR-087 thresholds) and Phase 12 (R2 + BR-060/061).
