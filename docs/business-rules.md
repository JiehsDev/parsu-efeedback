# Business Rule → Configuration Map

Full business rules text lives with the client (BR-001…BR-100). This file only
tracks the subset that are **configurable thresholds** rather than fixed
logic — i.e. rules that say "a configurable number/format" instead of
specifying an exact value. Each one is wired to exactly one environment
variable so the number lives in one place, not scattered across services.

Anything not listed here is either a fixed structural rule (e.g. BR-021 "every
complaint belongs to exactly one category") with no numeric knob, or a rule
enforced entirely in code/schema (e.g. BR-045 "deleting complaints is
prohibited").

| Rule | Requirement | Env var | Default | Consumed by (planned phase) |
|---|---|---|---|---|
| BR-013 | Account lockout after N failed logins, for a configurable duration | `AUTH_MAX_FAILED_LOGIN_ATTEMPTS`, `AUTH_LOCKOUT_DURATION_MINUTES` | `5`, `15` | Phase 6 — Auth.js `authorize()` |
| BR-087 | Sessions expire after a configurable inactivity period | `AUTH_SESSION_MAX_AGE_MINUTES` | `60` | Phase 6 — Auth.js session config |
| BR-060 | Only supported file formats may be uploaded | `UPLOAD_ALLOWED_MIME_TYPES` | see `.env.example` | Phase 12 — `/api/uploads/presign` |
| BR-061 | Maximum upload size shall be configurable | `UPLOAD_MAX_FILE_SIZE_MB` | `10` | Phase 12 — `/api/uploads/presign` |
| BR-036 / BR-100 | Ticket numbers unique, immutable, human-readable (e.g. `PARSU-2026-000001`) | `TICKET_NUMBER_PREFIX` | `PARSU` | Phase 8 — ticket number generator |

## Conventions

- Every var here is read through `src/lib/env.ts` (never `process.env.X`
  directly in feature code) so a missing/malformed value fails fast at boot
  with a clear error instead of surfacing as a confusing runtime bug later.
- Numeric vars are validated as positive integers; `UPLOAD_ALLOWED_MIME_TYPES`
  is validated as a non-empty comma-separated list and exposed to the app as
  a `string[]`.
- If a future business-rule revision changes a *default*, update it in three
  places: this table, `.env.example`, and the Zod default in `src/lib/env.ts`.
  If it changes a *rule ID or requirement*, update this table first — it's
  the source of truth for what each var means.
