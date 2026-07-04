# ParSU e-Feedback

Integrated Student Complaint and Feedback Management System with Institutional Analytics — Partido State University.

Status: Phase 1 (Project Initialization) complete. See `docs/architecture.md` (added in a later phase) for the full architecture blueprint.

## Stack

- Next.js 16 (App Router) + TypeScript (strict)
- TailwindCSS + shadcn/ui + Lucide React
- MongoDB Atlas (Mongoose) + Cloudflare R2 + Resend + Upstash

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm run format` / `npm run format:check` — Prettier
