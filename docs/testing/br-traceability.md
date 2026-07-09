<!-- docs/testing/br-traceability.md -->

# BR Traceability Matrix — ParSU e-Feedback

Maps each business rule to its test type and location. Status: ✅ tested, 🟡 partially covered, ⬜ not yet tested.

## 1. User Management

| BR     | Rule                              | Test Type   | Location              | Status |
| ------ | --------------------------------- | ----------- | --------------------- | ------ |
| BR-001 | One role per user                 | Unit        | `user.schema.test.ts` | ⬜     |
| BR-002 | Role assignable to multiple users | Integration | `admin-users.test.ts` | ⬜     |
| BR-003 | Unique email                      | Integration | `admin-users.test.ts` | ⬜     |
| BR-004 | Passwords hashed                  | Unit        | `password.test.ts`    | ⬜     |
| BR-005 | Active required to authenticate   | Integration | `auth.test.ts`        | ⬜     |
| BR-006 | Unique student number             | Integration | `admin-users.test.ts` | ⬜     |
| BR-007 | Unique employee ID                | Integration | `admin-users.test.ts` | ⬜     |
| BR-008 | Student → exactly one college     | Unit        | `user.schema.test.ts` | ⬜     |
| BR-009 | Staff → one office                | Unit        | `user.schema.test.ts` | ⬜     |
| BR-010 | Admin unrestricted access         | E2E         | `rbac.spec.ts`        | ⬜     |
| BR-011 | Only admin manages accounts       | Integration | `admin-users.test.ts` | ⬜     |
| BR-012 | lastLoginAt updated               | Integration | `auth.test.ts`        | ⬜     |
| BR-013 | Lockout after failed attempts     | Integration | `auth.test.ts`        | ⬜     |

## 2–3. Colleges & Offices

| BR         | Rule                                       | Test Type   | Location                  | Status |
| ---------- | ------------------------------------------ | ----------- | ------------------------- | ------ |
| BR-014–016 | College/user relationship, admin-only mgmt | Integration | `admin-offices.test.ts`   | ⬜     |
| BR-017–018 | Office ↔ category/staff relationships      | Integration | `admin-offices.test.ts`   | ⬜     |
| BR-019     | Unique office code                         | Integration | `admin-offices.test.ts`   | ⬜     |
| BR-020     | Inactive offices excluded from routing     | Unit        | `routing.service.test.ts` | ⬜     |

## 4–6. Category / Routing / SLA

| BR         | Rule                                                                            | Test Type          | Location                                              | Status |
| ---------- | ------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- | ------ |
| BR-021–022 | Complaint ↔ category relationship                                               | Integration        | `complaints.test.ts`                                  | ⬜     |
| BR-023     | One active routing rule per category                                            | Unit + Integration | `routing.service.test.ts`, `admin-categories.test.ts` | ⬜     |
| BR-024     | Inactive category not selectable                                                | Integration        | `complaints.test.ts`                                  | ⬜     |
| BR-025–028 | Routing rule mapping, auto-route, admin-only, no inactive office refs           | Unit               | `routing.service.test.ts`                             | ⬜     |
| BR-029–034 | SLA config, response/resolution deadlines, overdue flag, escalation, admin-only | Unit               | `sla.service.test.ts`                                 | ⬜     |

## 7. Complaint Lifecycle

| BR         | Rule                                    | Test Type   | Location                             | Status |
| ---------- | --------------------------------------- | ----------- | ------------------------------------ | ------ |
| BR-035     | Students only submit                    | Integration | `complaints.test.ts`                 | ⬜     |
| BR-036     | Unique ticket number                    | Unit        | `ticket-number.service.test.ts`      | ⬜     |
| BR-037     | Required fields before submission       | Unit        | `complaint.schema.test.ts`           | ⬜     |
| BR-038–039 | Complaint↔student relationship          | Integration | `complaints.test.ts`                 | ⬜     |
| BR-040–041 | Single current status, lifecycle order  | Unit        | `status-transitions.service.test.ts` | ⬜     |
| BR-042     | Closed complaints not student-editable  | Integration | `complaints.test.ts`                 | ⬜     |
| BR-043     | Reopen allowed for authorized personnel | Unit        | `status-transitions.service.test.ts` | ⬜     |
| BR-044     | Reopen count tracked                    | Integration | `complaints.test.ts`                 | ⬜     |
| BR-045     | No deletion; admin-only archive         | Integration | `complaints.test.ts`                 | ⬜     |
| BR-046     | Required timestamps present             | Integration | `complaints.test.ts`                 | ⬜     |

## 8–10. Assignment / Timeline / Attachments

| BR         | Rule                                                   | Test Type   | Location                               | Status |
| ---------- | ------------------------------------------------------ | ----------- | -------------------------------------- | ------ |
| BR-047–052 | Assignment records, authorized-only, immutable history | Integration | `assign.test.ts`                       | ⬜     |
| BR-053–057 | Timeline created per action, immutable                 | Integration | `complaints.test.ts`, `assign.test.ts` | ⬜     |
| BR-058–062 | Attachments metadata-only, allow-list, size limit      | Integration | `attachments.test.ts`                  | ⬜     |

## 11–12. Notes / Ratings

| BR         | Rule                                           | Test Type   | Location        | Status |
| ---------- | ---------------------------------------------- | ----------- | --------------- | ------ |
| BR-063–066 | Notes staff-only, students blocked, immutable  | Integration | `notes.test.ts` | ⬜     |
| BR-067–070 | One rating, student-only, post-resolution only | Integration | `rate.test.ts`  | ⬜     |

## 13–14. Notifications / Audit

| BR         | Rule                                         | Test Type   | Location                                 | Status |
| ---------- | -------------------------------------------- | ----------- | ---------------------------------------- | ------ |
| BR-071–074 | Notification model, read/unread, event types | Integration | `notifications.test.ts`                  | ⬜     |
| BR-075–077 | Audit log on admin actions, immutable        | Integration | `admin-users.test.ts` (audit assertions) | ⬜     |

## 15. Reports

| BR         | Rule                                                | Test Type   | Location          | Status |
| ---------- | --------------------------------------------------- | ----------- | ----------------- | ------ |
| BR-078–082 | Report ownership, formats, filters, recorded fields | Integration | `reports.test.ts` | ⬜     |

## 16. Authentication

| BR         | Rule                                           | Test Type   | Location           | Status |
| ---------- | ---------------------------------------------- | ----------- | ------------------ | ------ |
| BR-083–085 | Auth required, RBAC enforced, 403 on violation | E2E         | `rbac.spec.ts`     | ⬜     |
| BR-086     | No plaintext passwords                         | Unit        | `password.test.ts` | ⬜     |
| BR-087     | Session expiry                                 | Integration | `auth.test.ts`     | ⬜     |

## 17. Analytics

| BR         | Rule                                     | Test Type   | Location            | Status |
| ---------- | ---------------------------------------- | ----------- | ------------------- | ------ |
| BR-088–090 | Analytics generation, KPI set, freshness | Integration | `analytics.test.ts` | ⬜     |

## 18. Security (scope enforcement)

| BR         | Rule                                                       | Test Type         | Location                                 | Status |
| ---------- | ---------------------------------------------------------- | ----------------- | ---------------------------------------- | ------ |
| BR-091–096 | Role-scoped complaint access (student/staff/dean/QA/admin) | E2E               | `rbac.spec.ts`, `scope.spec.ts`          | ⬜     |
| BR-097     | Authorization before every action                          | Integration       | (cross-cutting, asserted per route test) | ⬜     |
| BR-098     | HTTPS / secure storage                                     | Deployment config | N/A (Phase 15)                           | ⬜     |

## 19. Data Integrity

| BR     | Rule                         | Test Type   | Location                        | Status |
| ------ | ---------------------------- | ----------- | ------------------------------- | ------ |
| BR-099 | FK references valid          | Integration | (per-model create tests)        | ⬜     |
| BR-100 | Unique immutable identifiers | Unit        | `ticket-number.service.test.ts` | ⬜     |
