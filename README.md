# ParSU e-Feedback

Integrated Student Complaint and Feedback Management System with Institutional Analytics — Partido State University.

Status: Phase 4 (Environment Variables) complete. See `docs/architecture.md` for the full architecture blueprint.

## Stack

- Next.js 16 (App Router) + TypeScript (strict)
- TailwindCSS + shadcn/ui + Lucide React
- MongoDB Atlas (Mongoose) + Cloudflare R2 + Resend + Upstash

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values — see docs/environment-variables.md
npm run dev
```

Every environment variable is documented in `docs/environment-variables.md`
(what it's for, where to get it) and validated at runtime by
`src/lib/env.ts` — missing/malformed values fail fast with a clear message
instead of a mystery error later. Business-rule-driven thresholds
(lockout attempts, session length, upload limits, etc.) are mapped to their
rule IDs in `docs/business-rules.md`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm run format` / `npm run format:check` — Prettier
