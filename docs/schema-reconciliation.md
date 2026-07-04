# Schema Reconciliation — Blueprint vs. Business Rules (BR-001…BR-100)

The architecture blueprint (`docs/architecture.md`) was written before the
business rules doc was available and flagged this explicitly as "Open
Question #2." This document records what changed once BR-001…BR-100 were
reconciled against it, in Phase 5, and why. `docs/architecture.md` itself
has been updated in place to reflect the final schema — this file is the
changelog explaining the deltas, not a second copy of the schema.

## New collections (were missing from the blueprint)

### `assignments` (BR-047–052)
The blueprint kept only `assignedOfficeRef`/`assignedStaffRef` directly on
`Complaint` — enough to know who has a ticket *now*, but not enough for
BR-047's "multiple assignment records throughout its lifecycle," each one
immutably recording assigner, assignee, source/destination office, and date
(BR-049), with prior records never modified (BR-052). Added `Assignment` as
its own append-only collection, parallel to `complaint_timeline` but with
assignment-specific structured fields instead of a generic message.
`Complaint.assignedOfficeRef/assignedStaffRef` remain as cheap
current-state pointers; `assignments` is the audit trail behind them.

### `generated_reports` (BR-078–082)
The blueprint's section 11 specified a **stateless** export endpoint
("streams file, no storage of generated reports"). BR-078/082 require the
opposite: a persisted record per generated report (creator, type, format,
filters, status, download URL, timestamp). Added `GeneratedReport`. The
export endpoint (`/api/reports/export`, Phase 14) will now write a row when
generation starts and update it to `ready`/`failed` with a `downloadUrl`
once complete, instead of only streaming a response.

## Changed fields/enums on existing collections

### `complaints`
- **Status enum renamed/extended** to match BR-041's named lifecycle:
  `submitted → assigned → in_progress → pending_information → resolved →
  closed`, with `escalated` kept as an operational sub-state (BR-032/033
  still need somewhere for "SLA breached, reassigned to escalation office"
  to live) and closed→in_progress reopening supported (BR-043).
  Blueprint's `routed`/`pending_student` renamed to `assigned`/
  `pending_information` to match the business rules' own terms.
- **Added** `submittedAt`, `resolvedAt`, `closedAt` — BR-046 requires all
  five of submitted/resolved/closed/created/updated as distinct
  timestamps; the blueprint only had `createdAt`/`updatedAt`.
- **Added** `reopenCount` — BR-044 ("system shall maintain the number of
  complaint reopenings").
- **Split** the blueprint's single `slaDueAt` into `slaResponseDueAt`
  (BR-030, first-response deadline) and `slaResolutionDueAt` (BR-031,
  resolution deadline) — two different clocks, previously only one.
- **Added** `isArchived` — BR-045 ("deleting complaints is prohibited;
  only administrators may archive complaints"); the blueprint had no
  archive flag, only an implicit "don't delete."
- Kept `lastWarningNotifiedAt` here (blueprint section 8 already specified
  it on the complaint, for SLA-warning idempotency — just made explicit in
  the schema).

### `complaint_timeline`
- `eventType` enum extended with `reopened` and `closed` (BR-041/044
  reopening needs a timeline event type it didn't have) and `routed`
  renamed to `assigned` to match the complaint status rename above.

### `offices`
- **Added** `code` (unique) — BR-019 ("each office shall have a unique
  office code"); the blueprint's Office schema had no code field.

### `sla_rules`
- **Added** `responseHours` alongside the blueprint's `resolutionHours` —
  needed once `complaints.slaResponseDueAt` exists as its own clock
  (BR-030 vs BR-031).
- **Added** a partial unique index on `{ categoryRef, priority }` where
  `isActive: true` — the concrete, enforceable version of BR-029's "each
  category shall have one SLA configuration."

### `routing_rules`
- **Added** a partial unique index on `{ categoryRef }` where
  `isActive: true` — same treatment for BR-023's "each category must have
  one active routing rule."

## What did *not* change

- Colleges are still modeled as `Office` documents with `type: "college"`
  rather than a separate collection — BR-014/015/016 don't require a
  distinct shape, and the blueprint's unified-hierarchy rationale
  (`docs/architecture.md` section 3) still holds.
- `User.employeeOrStudentId` stays a single field covering both BR-006
  (student number) and BR-007 (employee ID) — a user is exactly one of
  those (BR-001), never both, so one unique field is sufficient.
- Satisfaction ratings (BR-067–070) stay embedded on `Complaint`
  (`studentRating`, `studentRatingComment`) rather than becoming their own
  collection — bounded to exactly one per complaint, matches the
  blueprint's embedding rationale.

## Enforcement left out of the schema on purpose

Several business rules describe *behavioral* constraints, not data shape —
these are intentionally **not** schema-level hooks, to keep Phase 5 pure
persistence/shape with no business logic:

- BR-052 / BR-057 / BR-066 / BR-077 (various "never modified/deleted"
  rules) — enforced by only ever exposing create operations for those
  collections at the repository/service layer, starting Phase 8.
- BR-028 ("routing rules must not reference inactive offices") — a
  cross-collection check, enforced by the routing engine, Phase 9.
- BR-020 ("inactive offices shall not receive new assignments"),
  BR-024 ("inactive categories cannot be selected") — read by the
  submission/routing handlers, Phase 8/9; the models just expose the
  `isActive` flags they check.
