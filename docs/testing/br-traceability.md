<!-- docs/testing/br-traceability.md -->

# BR Traceability Matrix — ParSU e-Feedback

Maps each business rule to its test type and location. Status: ✅ tested & passing, 🟡 partially covered / covered indirectly, ⬜ not independently testable (reason noted), N/A deployment concern. (❌ would mean tested and failing — none remain; every gap found in the first pass has been fixed.)

Last full run: `npx vitest run` (30 files / 152 tests, **152 passed**) + `npx playwright test` (12 spec files / 55 tests, **54 passed / 1 skipped**). Every rule found failing in the first pass has since been fixed and reverified — see `docs/testing/br-test-results.md` for what was wrong and what changed.

## 1. User Management

| BR     | Rule                              | Test Type   | Location                                                                 | Status |
| ------ | ---------------------------------- | ----------- | ------------------------------------------------------------------------ | ------ |
| BR-001 | One role per user                 | Unit        | `src/features/admin/schemas/user.integration.test.ts`                    | ✅     |
| BR-002 | Role assignable to multiple users | —           | implicit (no uniqueness constraint on `role`; proven by every fixture)   | 🟡     |
| BR-003 | Unique email                      | Integration | `src/features/admin/schemas/user.integration.test.ts`                    | ✅     |
| BR-004 | Passwords hashed                  | Unit        | `src/lib/password.test.ts`, `src/features/auth/services/password.service.test.ts` | ✅     |
| BR-005 | Active required to authenticate   | Integration + E2E | `src/features/auth/services/auth.service.integration.test.ts`, `tests/e2e/auth.spec.ts` | ✅     |
| BR-006 | Unique student number             | Integration | `src/features/admin/schemas/user.integration.test.ts`                    | ✅     |
| BR-007 | Unique employee ID                | Integration | same unique index as BR-006 (`employeeOrStudentId`), covered but not separately labeled | 🟡     |
| BR-008 | Student → exactly one college     | Unit        | `src/features/admin/schemas/user.integration.test.ts`                    | ✅     |
| BR-009 | Staff → one office                | Unit        | `src/features/admin/schemas/user.integration.test.ts`                    | ✅     |
| BR-010 | Admin unrestricted access         | E2E         | `tests/e2e/rbac-redirects.spec.ts`                                       | ✅     |
| BR-011 | Only admin manages accounts       | Integration + E2E | `tests/e2e/admin-crud.spec.ts`                                    | ✅     |
| BR-012 | lastLoginAt updated               | Integration | `src/features/auth/services/auth.service.integration.test.ts`            | ✅     |
| BR-013 | Lockout after failed attempts     | Integration + E2E | `src/features/auth/services/auth.service.integration.test.ts`, `tests/e2e/auth.spec.ts` | ✅     |

## 2–3. Colleges & Offices

| BR         | Rule                                        | Test Type   | Location                                                         | Status |
| ---------- | -------------------------------------------- | ----------- | ------------------------------------------------------------------ | ------ |
| BR-014     | College/user relationship                    | Unit + Integration | `src/features/admin/schemas/office.schema.test.ts`, `src/models/office.integration.test.ts` | ✅     |
| BR-015     | Student ↔ college link (populatable)        | Integration | `src/models/office.integration.test.ts`                            | ✅     |
| BR-016     | Admin-only office management                 | E2E         | `tests/e2e/admin-crud.spec.ts`                                     | ✅     |
| BR-017     | Office ↔ category relationship               | —           | covered indirectly by `Category.defaultOfficeRef` usage elsewhere  | 🟡     |
| BR-018     | Office ↔ staff relationship                  | —           | covered indirectly by `User.officeRef` usage elsewhere             | 🟡     |
| BR-019     | Unique office code                            | Unit + Integration | `src/features/admin/schemas/office.schema.test.ts`, `src/models/office.integration.test.ts`, `tests/e2e/admin-crud.spec.ts` | ✅     |
| BR-020     | Inactive offices excluded from routing        | Unit        | `src/features/routing-engine/services/routing.service.test.ts`     | ✅     |

## 4–6. Category / Routing / SLA

| BR         | Rule                                                                            | Test Type          | Location                                                         | Status |
| ---------- | -------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------ | ------ |
| BR-021     | Complaint ↔ category relationship                                               | Integration + E2E  | `src/features/complaints/complaints.integration.test.ts`, `tests/e2e/complaint-submission.spec.ts` | ✅     |
| BR-022     | Category fixes default office/priority                                          | E2E                 | `tests/e2e/complaint-submission.spec.ts`                           | ✅     |
| BR-023     | One active routing rule per category                                            | Unit + Integration  | `src/app/api/admin/categories/category-activation.integration.test.ts`, `routing.service.test.ts` | ✅     |
| BR-024     | Inactive category not selectable                                                | Integration         | `src/app/api/admin/categories/category-activation.integration.test.ts` | ✅     |
| BR-025     | Routing rule maps a category to one office                                      | Unit                | `src/features/routing-engine/services/routing.service.test.ts`     | ✅     |
| BR-026     | Auto-route on submission                                                        | Unit + E2E          | `routing.service.test.ts`, `tests/e2e/complaint-submission.spec.ts` | ✅     |
| BR-027     | Admin-only routing rule management                                              | E2E                 | `tests/e2e/admin-crud.spec.ts`                                     | ✅     |
| BR-028     | No routing rule may reference an inactive office                                | Unit                | `src/features/routing-engine/services/routing.service.test.ts`     | ✅     |
| BR-029     | One active SLA rule per category (and per priority for institution defaults)    | Integration         | `src/features/sla/services/sla.service.integration.test.ts`        | ✅     |
| BR-030     | First-response SLA deadline                                                     | Unit                | `src/features/sla/services/sla.service.test.ts`                    | ✅     |
| BR-031     | Resolution SLA deadline                                                         | Unit                | `src/features/sla/services/sla.service.test.ts`                    | ✅     |
| BR-032     | isOverdue-style computation                                                     | Integration         | `src/features/sla/services/sla.service.integration.test.ts` (deadline math only — full flag-flip lives in the cron route, untested) | 🟡     |
| BR-033     | Escalation target/threshold configurable on the SLA rule                        | —                   | field exists on `SLARule` (`escalateToOfficeRef`, `warningThresholdPercent`); actual escalation trigger is inline in `src/app/api/cron/sla-check/route.ts`, not independently testable | ⬜     |
| BR-034     | Admin-only SLA rule management                                                  | E2E                 | `tests/e2e/admin-crud.spec.ts`                                     | ✅     |

## 7. Complaint Lifecycle

| BR         | Rule                                    | Test Type   | Location                                                       | Status |
| ---------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------ | ------ |
| BR-035     | Students only submit                    | Integration + E2E | `complaints.integration.test.ts`, `tests/e2e/complaint-submission.spec.ts` | ✅     |
| BR-036     | Unique ticket number                    | Unit        | `ticket-number.service.test.ts` (+ concurrency test in `.integration.test.ts`) | ✅     |
| BR-037     | Required fields before submission       | Integration + E2E | `complaints.integration.test.ts`, `tests/e2e/complaint-submission.spec.ts` | ✅     |
| BR-038     | Complaint↔student relationship          | Integration | `complaints.integration.test.ts`                                   | ✅     |
| BR-039     | Complaint retrievable by owning student | Integration + E2E | `complaints.integration.test.ts`, `tests/e2e/complaint-submission.spec.ts` | ✅     |
| BR-040     | Single current status                   | Unit        | `status-transitions.service.test.ts`                               | ✅     |
| BR-041     | Lifecycle order enforced                | Unit + E2E  | `status-transitions.service.test.ts`, `tests/e2e/complaint-status-lifecycle.spec.ts` | ✅     |
| BR-042     | Closed complaints not student-editable  | Integration + E2E | `complaints.integration.test.ts`, `tests/e2e/complaint-status-lifecycle.spec.ts` | ✅     |
| BR-043     | Reopen allowed for authorized personnel | Unit + E2E  | `status-transitions.service.test.ts`, `tests/e2e/complaint-status-lifecycle.spec.ts` | ✅     |
| BR-044     | Reopen count tracked                    | Integration + E2E | `complaints.integration.test.ts`, `tests/e2e/complaint-status-lifecycle.spec.ts` | ✅     |
| BR-045     | No deletion; admin-only archive         | Integration + E2E | `complaints.integration.test.ts`, `tests/e2e/complaint-status-lifecycle.spec.ts` | ✅     |
| BR-046     | Required timestamps present             | Integration | `complaints.integration.test.ts`                                   | ✅     |

## 8–10. Assignment / Timeline / Attachments

| BR         | Rule                                                   | Test Type   | Location                                                          | Status |
| ---------- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------- | ------ |
| BR-047     | Multiple append-only assignment records                  | Integration + E2E | `src/models/assignment.integration.test.ts`, `tests/e2e/assign-scoping.spec.ts` | ✅     |
| BR-048     | Authorized reassignment (role/scope gated)                | E2E         | `tests/e2e/assign-scoping.spec.ts`                                   | ✅     |
| BR-049     | Required fields + assignment timestamp                    | Integration | `src/models/assignment.integration.test.ts`                          | ✅     |
| BR-050     | System-originated initial assignment (`assignedByRef:null`) | Integration + E2E | `src/models/assignment.integration.test.ts`, `tests/e2e/assign-scoping.spec.ts` | ✅     |
| BR-051     | Reassignment creates a new record, not a mutation          | E2E         | `tests/e2e/assign-scoping.spec.ts`                                   | ✅     |
| BR-052     | Assignment history immutable                                | Integration | `src/models/assignment.integration.test.ts` (convention-only, no schema-level lock, documented not asserted) | 🟡     |
| BR-053     | Timeline entry per significant action                       | E2E         | proven per-endpoint, `tests/e2e/complaint-status-lifecycle.spec.ts` and others | ✅     |
| BR-054     | Timeline entries created with actor + event type             | Integration | `src/models/complaint-timeline.integration.test.ts`                  | ✅     |
| BR-055     | `actorRef: null` valid for system-generated entries          | Integration | `src/models/complaint-timeline.integration.test.ts`                  | ✅     |
| BR-056     | `eventType` restricted to a fixed enum                        | Integration | `src/models/complaint-timeline.integration.test.ts`                  | ✅     |
| BR-057     | Timeline immutable                                            | Integration | `src/models/complaint-timeline.integration.test.ts` (convention-only, documented not asserted) | 🟡     |
| BR-058     | Multiple attachments per complaint                             | Integration + E2E | `attachments.integration.test.ts`, `tests/e2e/attachments.spec.ts` | ✅     |
| BR-059     | Metadata-only storage (no binary field)                        | Integration | `attachments.integration.test.ts`                                    | ✅     |
| BR-060     | Configurable allowed MIME types                                 | Integration + E2E | `attachments.integration.test.ts`, `tests/e2e/attachments.spec.ts` | ✅     |
| BR-061     | Configurable max file size                                       | Integration + E2E | `attachments.integration.test.ts`, `tests/e2e/attachments.spec.ts` | ✅     |
| BR-062     | Attachment deletion doesn't cascade to complaint                  | Integration | `attachments.integration.test.ts`                                    | ✅     |

## 11–12. Notes / Ratings

| BR         | Rule                                           | Test Type   | Location                                                       | Status |
| ---------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------------ | ------ |
| BR-063     | Notes staff-only / isInternal defaults true      | Integration + E2E | `notes.integration.test.ts`, `tests/e2e/notes-and-notifications.spec.ts` | ✅     |
| BR-064     | Notes never exposed to students                  | Integration + E2E | `notes.integration.test.ts`, `tests/e2e/notes-and-notifications.spec.ts` | ✅     |
| BR-065     | Note belongs to exactly one complaint            | Integration | `notes.integration.test.ts`                                        | ✅     |
| BR-066     | Notes immutable (append-only)                    | Integration | `notes.integration.test.ts`                                        | ✅     |
| BR-067     | One rating (1–5) per complaint                   | Integration + E2E | `rating.integration.test.ts`, `tests/e2e/rating.spec.ts`           | ✅     |
| BR-068     | Rating by submitting student only                | E2E         | `tests/e2e/rating.spec.ts`                                         | ✅     |
| BR-069     | Rating allowed only after "resolved" status      | Integration + E2E | `rating.integration.test.ts`, `tests/e2e/rating.spec.ts`           | ✅     |
| BR-070     | Rating value + comment persisted together        | Integration | `rating.integration.test.ts`                                       | ✅     |

## 13–14. Notifications / Audit

| BR         | Rule                                         | Test Type   | Location                                                       | Status |
| ---------- | ----------------------------------------------- | ----------- | ------------------------------------------------------------------ | ------ |
| BR-071     | Notifications generated on trigger events        | Integration + E2E | `notifications.integration.test.ts`, `tests/e2e/notes-and-notifications.spec.ts` | ✅     |
| BR-072     | A user may receive multiple notifications         | Integration | `notifications.integration.test.ts`                                | ✅     |
| BR-073     | Default unread, can be marked read                | Integration + E2E | `notifications.integration.test.ts`, `tests/e2e/notes-and-notifications.spec.ts` | ✅     |
| BR-074     | `type` restricted to documented event types       | Integration | `notifications.integration.test.ts`                                | ✅     |
| BR-075     | System events recorded (`actorRef:null`)          | Integration | `audit-log.integration.test.ts`                                    | ✅     |
| BR-076     | Audit entry records user/action/entity/timestamp  | Integration | `audit-log.integration.test.ts`                                    | ✅     |
| BR-077     | Audit log immutable (no delete route)             | Integration | `audit-log.integration.test.ts`                                    | ✅     |

## 15. Reports

| BR         | Rule                                                | Test Type   | Location                                                        | Status |
| ---------- | ------------------------------------------------------ | ----------- | -------------------------------------------------------------------- | ------ |
| BR-078     | Report belongs to exactly one creating user             | Integration + E2E | `generated-report.integration.test.ts`, `tests/e2e/reports.spec.ts` | ✅     |
| BR-079     | Multi-format (PDF/Excel/CSV)                             | Unit + E2E  | `report-file.service.test.ts`, `tests/e2e/reports.spec.ts`          | ✅     |
| BR-080     | Filterable (office/college/category/date/status/SLA)     | Unit + Integration | `report.schema.test.ts`, `report-data.service.integration.test.ts` | ✅     |
| BR-081     | Filters persisted alongside the report record             | Integration | `generated-report.integration.test.ts`                               | ✅     |
| BR-082     | Generation timestamp recorded                             | Integration | `generated-report.integration.test.ts`                               | ✅     |

## 16. Authentication

| BR         | Rule                                           | Test Type   | Location                                                        | Status |
| ---------- | ------------------------------------------------- | ----------- | -------------------------------------------------------------------- | ------ |
| BR-083     | Session required on protected routes               | E2E         | `tests/e2e/auth.spec.ts`, `tests/e2e/rbac-redirects.spec.ts`         | ✅     |
| BR-084     | RBAC enforced (route + handler, defense-in-depth)  | E2E         | `tests/e2e/rbac-redirects.spec.ts`, `tests/e2e/session-revocation.spec.ts` | ✅     |
| BR-085     | Unauthorized → redirect (pages) / 403 JSON (API)   | E2E         | `tests/e2e/rbac-redirects.spec.ts`, `tests/e2e/admin-crud.spec.ts` | ✅     |
| BR-086     | No plaintext passwords                             | Unit        | `password.service.test.ts`, `password.test.ts`                       | ✅     |
| BR-087     | Configurable session inactivity timeout            | —           | `tests/e2e/auth.spec.ts` (`test.skip`, documented untestable — would require waiting out a real session TTL) | ⬜     |

## 17. Analytics

| BR         | Rule                                     | Test Type   | Location                                                        | Status |
| ---------- | ------------------------------------------- | ----------- | -------------------------------------------------------------------- | ------ |
| BR-088     | Aggregate volume/resolution/SLA analytics    | Integration | `analytics.service.integration.test.ts`                              | ✅     |
| BR-089     | Defined KPI set, scoped by role              | Integration + E2E | `analytics.service.integration.test.ts`, `tests/e2e/analytics.spec.ts` | ✅     |
| BR-090     | Live (non-batch) aggregation                 | Integration | `analytics.service.integration.test.ts`                              | ✅     |

## 18. Security (scope enforcement)

| BR         | Rule                                                       | Test Type         | Location                                 | Status |
| ---------- | ------------------------------------------------------------ | ------------------ | ------------------------------------------- | ------ |
| BR-091     | Route-level scoping table exists and is correct               | Unit + E2E         | `src/middleware/rbac.test.ts`, `tests/e2e/rbac-redirects.spec.ts` | ✅     |
| BR-092     | Student scoped to own complaints only                          | E2E                | `tests/e2e/rbac-redirects.spec.ts`          | ✅     |
| BR-093     | Staff scoped to own office                                     | E2E                | `tests/e2e/rbac-redirects.spec.ts`, `tests/e2e/assign-scoping.spec.ts` | ✅     |
| BR-094     | Dean scoped to own college                                     | E2E                | `tests/e2e/rbac-redirects.spec.ts`, `tests/e2e/analytics.spec.ts`, `tests/e2e/assign-scoping.spec.ts` | ✅     |
| BR-095     | QA read-only, institution-wide                                 | E2E                | `tests/e2e/analytics.spec.ts`               | ✅     |
| BR-096     | Admin unrestricted across all scopes                            | E2E                | `tests/e2e/rbac-redirects.spec.ts`          | ✅     |
| BR-097     | Authorization re-checked at the handler, not just middleware    | E2E                | `tests/e2e/admin-crud.spec.ts`, `tests/e2e/session-revocation.spec.ts` | ✅     |
| BR-098     | HTTPS / secure storage of secrets at rest                        | Deployment config  | N/A — not exercised by an automated test    | N/A    |

## 19. Data Integrity

| BR     | Rule                         | Test Type   | Location                                              | Status |
| ------ | ----------------------------- | ----------- | ---------------------------------------------------------- | ------ |
| BR-099 | FK references valid            | Integration | `src/models/referential-integrity.integration.test.ts`, `src/lib/mongoose-ref-integrity.ts` | ✅     |
| BR-100 | Unique immutable identifiers   | Unit        | `ticket-number.service.test.ts` (+ concurrency test in `.integration.test.ts`) | ✅     |
