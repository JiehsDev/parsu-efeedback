# ParSU e-Feedback — Architecture Blueprint (Pre-Implementation)

Status: **Planning only. No application code written.** This document is the reference we'll build against. Once you approve/adjust it, we start Phase 1 (Project Initialization) per the incremental build order in your spec.

---

## 1. Complete Project Folder Structure

```
parsu-efeedback/
├── .env.local                          # local secrets (never committed)
├── .env.example                        # documented env template
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tsconfig.json
├── package.json
├── middleware.ts                       # auth + RBAC gate on every matched route
│
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/[token]/page.tsx
│   │   │
│   │   ├── student/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── complaints/
│   │   │   │   ├── page.tsx                # list/track
│   │   │   │   ├── new/page.tsx             # submission
│   │   │   │   └── [id]/page.tsx            # timeline + rating
│   │   │   ├── feedback/new/page.tsx
│   │   │   └── profile/page.tsx
│   │   │
│   │   ├── staff/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── complaints/
│   │   │   │   ├── page.tsx                # assigned queue
│   │   │   │   └── [id]/page.tsx            # notes, status, resolution docs
│   │   │   └── sla/page.tsx
│   │   │
│   │   ├── dean/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── complaints/page.tsx
│   │   │   └── analytics/page.tsx
│   │   │
│   │   ├── qa/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── sla-compliance/page.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── offices/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── routing-rules/page.tsx
│   │   │   ├── sla-rules/page.tsx
│   │   │   ├── audit-logs/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── complaints/
│   │   │   │   ├── route.ts                 # GET (list), POST (create)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts             # GET/PATCH
│   │   │   │       ├── assign/route.ts
│   │   │   │       ├── notes/route.ts
│   │   │   │       ├── attachments/route.ts
│   │   │   │       └── rate/route.ts
│   │   │   ├── uploads/
│   │   │   │   └── presign/route.ts         # R2 presigned URL
│   │   │   ├── cron/
│   │   │   │   └── sla-check/route.ts       # hourly Vercel Cron / Upstash Workflow target
│   │   │   ├── reports/
│   │   │   │   └── export/route.ts
│   │   │   ├── admin/
│   │   │   │   ├── users/route.ts
│   │   │   │   ├── offices/route.ts
│   │   │   │   ├── categories/route.ts
│   │   │   │   ├── routing-rules/route.ts
│   │   │   │   └── sla-rules/route.ts
│   │   │   └── notifications/route.ts
│   │   │
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                              # shadcn/ui primitives
│   │   ├── shared/                          # navbars, sidebars, tables, charts
│   │   ├── complaints/
│   │   ├── analytics/
│   │   └── forms/
│   │
│   ├── features/                            # feature-based domain modules
│   │   ├── auth/
│   │   │   ├── services/
│   │   │   ├── schemas/                     # Zod
│   │   │   └── hooks/
│   │   ├── complaints/
│   │   │   ├── services/
│   │   │   ├── repository/                  # Repository Pattern
│   │   │   ├── schemas/
│   │   │   └── hooks/
│   │   ├── routing-engine/
│   │   │   └── services/
│   │   ├── sla/
│   │   │   └── services/
│   │   ├── notifications/
│   │   │   ├── services/
│   │   │   └── templates/                   # React Email templates
│   │   ├── analytics/
│   │   │   └── services/
│   │   └── audit-log/
│   │       └── services/
│   │
│   ├── lib/
│   │   ├── db.ts                            # Mongoose connection (singleton)
│   │   ├── auth.ts                          # Auth.js config
│   │   ├── r2.ts                            # Cloudflare R2 client
│   │   ├── resend.ts                        # Resend client
│   │   ├── rate-limit.ts                    # Upstash Redis rate limiter
│   │   ├── logger.ts
│   │   ├── constants.ts
│   │   └── env.ts                           # added in Phase 4 — validated env access
│   │
│   ├── models/                              # Mongoose schemas
│   │   ├── User.ts
│   │   ├── Office.ts
│   │   ├── Category.ts
│   │   ├── Complaint.ts
│   │   ├── ComplaintTimeline.ts
│   │   ├── ComplaintNote.ts
│   │   ├── Attachment.ts
│   │   ├── RoutingRule.ts
│   │   ├── SLARule.ts
│   │   ├── Notification.ts
│   │   ├── AuditLog.ts
│   │   ├── Feedback.ts
│   │   ├── Assignment.ts                    # added in Phase 5 reconciliation (BR-047..052)
│   │   ├── GeneratedReport.ts                # added in Phase 5 reconciliation (BR-078..082)
│   │   └── index.ts                         # barrel export
│   │
│   ├── types/                                # shared TS types/interfaces
│   ├── hooks/                                 # global reusable hooks
│   └── middleware/
│       └── rbac.ts                            # role-check helpers used by middleware.ts
│
├── emails/                                    # React Email templates (build-time preview)
├── public/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    └── architecture.md                        # this document, versioned
```

**Rationale:** Role areas (`student/`, `staff/`, `dean/`, `qa/`, `admin/`) are real path segments, not route groups — each role has its own `/dashboard`, `/complaints`, `/analytics`, etc., and Next.js route groups (parenthesized folders) don't add a URL segment, so using them here would make e.g. every role's dashboard resolve to the same `/dashboard` URL and collide. `(public)` remains a true route group since its paths (`/login`, `/register`, ...) are already unique — it only exists to keep the public pages out of any role's layout tree. `features/` holds business logic (services, repository, schemas, hooks) separate from `app/` (routing/presentation) and `models/` (persistence) — this is what prevents spaghetti code as the app grows past prototype size.

---

## 2. System Architecture Diagram (Text Format)

```
                                   ┌─────────────────────────────┐
                                   │        End Users            │
                                   │ Student / Staff / Dean /     │
                                   │ QA Office / Administrator    │
                                   └──────────────┬───────────────┘
                                                  │ HTTPS
                                                  ▼
                        ┌───────────────────────────────────────────────┐
                        │   Cloudflare Pages  (or Vercel Hobby)         │
                        │   Next.js 15/16 App Router (SSR + RSC)        │
                        │   ┌───────────────────────────────────────┐  │
                        │   │ middleware.ts                        │  │
                        │   │  → Auth.js session check             │  │
                        │   │  → Role-based route protection       │  │
                        │   └───────────────────────────────────────┘  │
                        │   ┌───────────────┐   ┌───────────────────┐  │
                        │   │ Route Handlers │   │ Server Actions    │  │
                        │   │ /api/*         │   │ (mutations)       │  │
                        │   └───────┬────────┘   └─────────┬─────────┘  │
                        └───────────┼──────────────────────┼────────────┘
                                    │                       │
              ┌─────────────────────┼───────────────────────┼─────────────────────┐
              ▼                     ▼                       ▼                     ▼
   ┌─────────────────┐   ┌────────────────────┐   ┌──────────────────┐  ┌──────────────────┐
   │ MongoDB Atlas M0 │   │ Cloudflare R2       │   │ Resend            │  │ Upstash            │
   │ (Mongoose ODM)   │   │ (file storage:      │   │ (transactional     │  │ Redis (rate-limit) │
   │ - Users          │   │  evidence, docs)    │   │  email via React   │  │ + Workflow / QStash │
   │ - Complaints      │   │ Metadata only in    │   │  Email templates)  │  │ (hourly SLA cron)   │
   │ - Offices        │   │ MongoDB (URL, name, │   └──────────────────┘  └──────────────────┘
   │ - AuditLogs, etc.│   │ size, mime)          │
   └─────────────────┘   └────────────────────┘

                        ┌───────────────────────────────────────────┐
                        │  Scheduled Job (Vercel Cron / Upstash      │
                        │  Workflow) → hits /api/cron/sla-check      │
                        │  hourly → checks SLA breaches, escalates,  │
                        │  sends emails, writes notifications        │
                        └───────────────────────────────────────────┘
```

**Key point:** There is no long-running Node process. Every "background" behavior is either (a) triggered synchronously inside a request/Server Action, or (b) triggered externally on a schedule by Vercel Cron/Upstash Workflow hitting a stateless API route. This matches the serverless constraint you flagged.

---

## 3. Database Architecture (MongoDB / Mongoose, normalized to 3NF-equivalent)

MongoDB is document-oriented, so "3NF" here means: **no duplicated mutable data, references instead of embedding where data is reused or grows unboundedly, embedding only for small/immutable/tightly-coupled sub-documents.**

> **Reconciled in Phase 5** against the business rules doc (BR-001…BR-100)
> provided after this document was first drafted. What's below is the final
> schema; `docs/schema-reconciliation.md` is the changelog explaining every
> delta from the original draft (two new collections, several renamed/added
> fields) and why. The Mongoose source of truth is `src/models/*.ts` — this
> section is kept in sync with it, not the other way around.

### Core Collections

**users**
```
_id, employeeOrStudentId (unique), firstName, lastName, email (unique, indexed),
passwordHash, role (enum: student|office_staff|college_dean|qa_office|administrator),
officeRef (ref: offices, nullable — staff/dean only),
collegeRef (ref: offices, nullable — student's college),
isActive, lastLoginAt, failedLoginAttempts, lockedUntil, createdAt, updatedAt
Index: { email: 1 } unique, { role: 1, officeRef: 1 }, { collegeRef: 1 }
```

**offices** (colleges + service offices, unified hierarchy)
```
_id, name, type (enum: college|service_office), code (unique),
parentOffice (ref, nullable), headUserRef (ref: users), isActive, createdAt
Index: { type: 1 }, { parentOffice: 1 }
```

**categories**
```
_id, name, description, defaultOfficeRef (ref: offices, for routing),
defaultPriority (enum: low|medium|high|critical), isActive
Index: { name: 1 } unique
```

**complaints** (the aggregate root)
```
_id, ticketNumber (unique, indexed, e.g. PARSU-2026-000123),
studentRef (ref: users), categoryRef (ref: categories),
title, description, priority, status
  (enum: submitted|assigned|in_progress|pending_information|escalated|resolved|closed),
assignedOfficeRef (ref: offices), assignedStaffRef (ref: users, nullable),
slaResponseDueAt (Date), slaResolutionDueAt (Date), isOverdue (bool, updated by cron),
lastWarningNotifiedAt (Date, nullable — SLA-warning idempotency guard),
resolutionSummary, studentRating (1–5, nullable), studentRatingComment,
reopenCount (int), isArchived (bool),
submittedAt, resolvedAt (nullable), closedAt (nullable), createdAt, updatedAt
Index: { ticketNumber: 1 } unique
Index: { studentRef: 1, createdAt: -1 }
Index: { assignedOfficeRef: 1, status: 1 }
Index: { assignedStaffRef: 1, status: 1 }
Index: { status: 1, slaResolutionDueAt: 1 }   ← used heavily by the hourly SLA cron
Index: { status: 1, slaResponseDueAt: 1 }
```
Status names and the two SLA date fields were reconciled to BR-041/BR-030/BR-031 — see `docs/schema-reconciliation.md`.

**complaint_timeline** (append-only event log per complaint — powers the "Complaint Timeline" UI)
```
_id, complaintRef (ref: complaints), eventType
  (enum: submitted|assigned|reassigned|status_changed|note_added|
         attachment_added|escalated|resolved|reopened|closed|rated),
actorRef (ref: users, nullable for system events), fromValue, toValue,
message, createdAt
Index: { complaintRef: 1, createdAt: 1 }
```
Kept separate from `complaints` (not embedded) because it's an unbounded, append-only array — embedding would blow past MongoDB's 16MB document limit on long-lived, high-traffic tickets and would bloat every read of the complaint itself.

**complaint_notes** (internal staff notes — separate from timeline because notes are role-gated/private, never shown to students)
```
_id, complaintRef (ref: complaints), authorRef (ref: users),
body, isInternal (always true, but explicit for a defense-in-depth query filter),
createdAt
Index: { complaintRef: 1, createdAt: 1 }
```

**attachments** (metadata only — binary lives in R2)
```
_id, complaintRef (ref: complaints), uploadedByRef (ref: users),
fileUrl (R2 object URL), fileName, mimeType, sizeBytes,
uploadedAt
Index: { complaintRef: 1 }
```

**routing_rules**
```
_id, categoryRef (ref: categories), conditions (embedded — small, static:
  e.g. { collegeRef, priority }), targetOfficeRef (ref: offices),
priority (rule evaluation order), isActive
Index: { categoryRef: 1 } unique, partial (isActive: true)   ← BR-023: one active rule per category
```

**sla_rules**
```
_id, categoryRef (ref: categories, nullable = institution-wide default),
priority (enum), responseHours (int), resolutionHours (int),
warningThresholdPercent (e.g. 80), escalateToOfficeRef (ref: offices), isActive
Index: { categoryRef: 1, priority: 1 } unique, partial (isActive: true)  ← BR-029
```
`responseHours` added alongside the original `resolutionHours` so BR-030 (response deadline) and BR-031 (resolution deadline) each have a source.

**notifications**
```
_id, userRef (ref: users), type (enum: complaint_submitted|complaint_assigned|
  status_updated|sla_warning|escalation|complaint_resolved|report_generated),
title, body, relatedComplaintRef (ref: complaints, nullable), isRead, createdAt
Index: { userRef: 1, isRead: 1, createdAt: -1 }
```

**audit_logs** (immutable — insert-only, no update/delete ever performed by app code)
```
_id, actorRef (ref: users, nullable), action, entityType, entityId,
beforeState (embedded snapshot, small), afterState (embedded snapshot),
ipAddress, userAgent, createdAt
Index: { entityType: 1, entityId: 1 }, { actorRef: 1, createdAt: -1 }
```

**feedback** (standalone suggestions/feedback not tied to a complaint)
```
_id, studentRef (ref: users), category, message, isAnonymous, createdAt
```

**assignments** — *added in Phase 5 reconciliation, BR-047…052*
```
_id, complaintRef (ref: complaints),
assignedByRef (ref: users, nullable — null = system/initial routing),
assignedToRef (ref: users, nullable — null = office-level, unclaimed),
sourceOfficeRef (ref: offices, nullable), destinationOfficeRef (ref: offices),
createdAt
Index: { complaintRef: 1, createdAt: 1 }
```
The append-only assignment history BR-047–052 require. `complaints.assignedOfficeRef/assignedStaffRef` stay as cheap current-state pointers; this collection is the immutable audit trail behind them — never updated/deleted, only inserted.

**generated_reports** — *added in Phase 5 reconciliation, BR-078…082*
```
_id, creatorRef (ref: users), reportType, fileFormat (enum: pdf|excel|csv),
filters (embedded: officeRef, collegeRef, categoryRef, dateFrom, dateTo, status, slaOnly),
status (enum: pending|generating|ready|failed), downloadUrl (nullable),
createdAt, updatedAt
Index: { creatorRef: 1, createdAt: -1 }
```
Replaces the originally-stateless export design in section 11 below, which conflicted with BR-078/082's requirement that reports be persisted records, not just streamed responses.

### Design notes
- Embedding is used only for small, bounded, rarely-independently-queried data (`routing_rules.conditions`, `audit_logs.beforeState/afterState`, `generated_reports.filters`).
- Referencing is used everywhere data is reused across documents (users↔offices) or grows unboundedly (timeline, notes, attachments, audit logs, assignments) — this is the Mongo equivalent of avoiding update/insert/delete anomalies, i.e. your 3NF requirement.
- Every collection that the SLA cron or dashboards query heavily has a compound index matching that access pattern — this is the single biggest cost/performance lever on a free M0 tier (512MB, shared vCPU).
- Partial unique indexes (`routing_rules`, `sla_rules`) enforce BR-023/029's "exactly one active configuration" at the database level rather than trusting application code alone.

---

## 4. API Architecture

Convention: REST-ish Route Handlers for cross-cutting/queryable resources; Server Actions for simple form mutations tied to a single page.

```
Auth
  POST   /api/auth/[...nextauth]         Auth.js (login/logout/session), credentials + JWT

Complaints
  GET    /api/complaints                 List (role-scoped, filtered/paginated)
  POST   /api/complaints                 Create (student)
  GET    /api/complaints/:id             Detail (role-scoped)
  PATCH  /api/complaints/:id             Update status/priority (staff/dean/admin)
  POST   /api/complaints/:id/assign      Reassign (staff/dean/admin)
  POST   /api/complaints/:id/notes       Add internal note (staff/dean/qa/admin)
  POST   /api/complaints/:id/attachments Attach file metadata after R2 upload
  POST   /api/complaints/:id/rate        Student rates resolution

Uploads
  POST   /api/uploads/presign            Issue short-lived R2 presigned PUT URL

Notifications
  GET    /api/notifications              List for current user
  PATCH  /api/notifications/:id/read     Mark read

Cron (internal, secret-header protected — not user-facing)
  POST   /api/cron/sla-check             Triggered hourly by Vercel Cron/Upstash Workflow

Reports & Analytics
  GET    /api/reports/export             CSV/PDF export (qa/admin/dean, scoped)
  GET    /api/analytics/summary          KPI aggregates (role-scoped)

Admin
  GET/POST/PATCH/DELETE /api/admin/users
  GET/POST/PATCH/DELETE /api/admin/offices
  GET/POST/PATCH/DELETE /api/admin/categories
  GET/POST/PATCH/DELETE /api/admin/routing-rules
  GET/POST/PATCH/DELETE /api/admin/sla-rules
```

**Cross-cutting rules applied to every handler:**
1. `middleware.ts` verifies a valid Auth.js session before the request reaches the handler.
2. Each handler re-checks role + resource ownership/scope server-side (never trust client-supplied role/office).
3. Every request body is parsed through a Zod schema before touching Mongoose.
4. Every mutating handler writes an `audit_logs` entry.
5. Rate limiting (Upstash Redis) applied to `/api/auth/*` and `/api/complaints` POST to blunt brute force / spam.

---

## 5. Authentication Flow

```
1. User submits email + password → POST /api/auth/callback/credentials (Auth.js)
2. Auth.js `authorize()` callback:
     a. Zod-validates input shape
     b. Looks up user by email in MongoDB
     c. bcrypt.compare(password, user.passwordHash)
     d. Rate-limit check (Upstash) — throttle repeated failures per IP+email
     e. On success: returns { id, email, role, officeRef, collegeRef }
3. Auth.js `jwt()` callback embeds { userId, role, officeRef, collegeRef } into the JWT
4. Auth.js `session()` callback exposes those fields on `session.user` for client/server use
5. JWT stored as httpOnly, secure, sameSite=lax cookie
6. Every subsequent request:
     middleware.ts → getToken() → verify signature/expiry → attach to request context
7. Logout: Auth.js signOut() clears the session cookie
8. Password reset:
     a. POST /api/auth/forgot-password → generate single-use token (hashed, stored, TTL)
     b. Resend email with reset link
     c. POST /api/auth/reset-password/:token → verify token, bcrypt-hash new password
```

**Why JWT (not database sessions):** MongoDB Atlas M0 has limited connections/storage; JWT avoids a session-lookup query on every request and works cleanly with serverless/edge middleware. Trade-off: revoking a session before expiry requires a token-blacklist (short-lived tokens + refresh, or a `tokenVersion` field on `users` checked in the `jwt()` callback) — we'll implement `tokenVersion` so admins can force-logout a compromised account.

---

## 6. RBAC Flow

```
Role hierarchy (not inheritance — explicit per-permission checks):
  student < office_staff < college_dean < qa_office < administrator
  (administrator is NOT "super staff" — it has a distinct permission set, not staff+extra)

Request → middleware.ts:
  1. Extract JWT → { role, officeRef, collegeRef }
  2. Match request path against route access table:
       /student/*     → role === 'student'
       /staff/*       → role === 'office_staff'
       /dean/*        → role === 'college_dean'
       /qa/*          → role === 'qa_office'
       /admin/*       → role === 'administrator'
       /api/admin/*   → role === 'administrator'
  3. No match → redirect to /login or return 403 JSON for API routes

Inside handlers (defense in depth — never rely on middleware alone):
  4. Re-check role explicitly
  5. Scope the query, not just the permission:
       staff  → complaints.assignedOfficeRef === session.officeRef
       dean   → complaints.studentRef.collegeRef === session.collegeRef
       qa     → no office scope, institution-wide read, but no write to complaint content
       admin  → no scope restriction, but every action is audit-logged
  6. Reject if resource scope doesn't match session scope, even if role matches
```

**Why defense-in-depth matters here:** middleware protects *routes*; it does not know that "staff A" shouldn't see office B's complaint just because both are "staff". Scope-checking inside each handler is what actually prevents Broken Access Control (OWASP #1).

---

## 7. Complaint Workflow (status lifecycle)

> Status names reconciled to BR-041 in Phase 5 — `routed`/`pending_student`
> from the original draft are now `assigned`/`pending_information`; a
> reopen path was added (BR-043/044). See `docs/schema-reconciliation.md`.

```
submitted
   │  (Routing Engine evaluates routing_rules by category/college/priority;
   │   writes an `assignments` record — BR-047)
   ▼
assigned ─────────────► assignedOfficeRef set, slaResponseDueAt/
   │                     slaResolutionDueAt computed from sla_rules
   ▼
in_progress ◄────────── staff picks up / self-assigns (new `assignments`
   │        │            record if reassigned — BR-051)
   │        ├──► pending_information  (staff needs more info from student)
   │        │        │
   │        │        └──► in_progress (student responds)
   │        │
   │        ├──► escalated  (SLA breach OR manual escalation by dean/qa)
   │        │        └──► in_progress (re-assigned to escalation office,
   │        │             new `assignments` record)
   │        │
   ▼        ▼
resolved ────────────► student notified, rating window opens
   │             │
   │             └──► in_progress  (reopened by authorized personnel —
   │                  BR-043; reopenCount += 1 — BR-044)
   ▼
closed  (auto-closed after N days with no dispute, or student confirms)
   │
   └──► in_progress  (reopened after closure — BR-041; reopenCount += 1)

Every transition:
  - Written to complaint_timeline (immutable)
  - Triggers a notification (in-app + email via Resend)
  - Triggers an audit_logs entry when performed by staff/dean/qa/admin
```

---

## 8. SLA Workflow

> Reconciled in Phase 5: BR-030 (response deadline) and BR-031 (resolution
> deadline) are two different clocks, so the single `slaDueAt` from the
> original draft is now `slaResponseDueAt` + `slaResolutionDueAt` on
> `Complaint`. `lastWarningNotifiedAt` lives on `Complaint` too (not a
> separate collection) — see `docs/schema-reconciliation.md`.

```
At routing time (assigned status, BR-030/031):
  slaResponseDueAt   = assignedAt + sla_rules[category/priority].responseHours
  slaResolutionDueAt = assignedAt + sla_rules[category/priority].resolutionHours

Hourly (Vercel Cron / Upstash Workflow → POST /api/cron/sla-check, header-secret protected):
  1. Query: complaints where status NOT IN (resolved, closed)
              AND slaResolutionDueAt <= now + warningThreshold  (uses the
              compound index { status: 1, slaResolutionDueAt: 1 } — critical
              on a shared M0 cluster); a second pass does the same against
              slaResponseDueAt for first-response breaches
  2. For each:
       a. now >= slaResolutionDueAt      → mark isOverdue = true, status → escalated,
                                            reassign per sla_rules.escalateToOfficeRef,
                                            new `assignments` record (BR-047),
                                            send "Escalation" email + notification
       b. now within warning window       → send "SLA Warning" email + notification
                                            (idempotent — checks Complaint.lastWarningNotifiedAt
                                            so we don't resend every hour)
  3. Write one audit_logs entry per escalation
```

**Trade-off called out:** Hourly granularity (not real-time) is a deliberate choice to fit free-tier cron limits and avoid needing a persistent worker. If sub-hour SLA precision is later required, that's a paid-tier / dedicated-worker change, not something serverless cron does well.

---

## 9. Notification Workflow

```
Trigger events: complaint submitted / assigned / status changed / resolved,
                SLA warning, escalation, password reset

On trigger (inside the Server Action/Route Handler that caused the event):
  1. Write a `notifications` document (in-app bell/inbox)
  2. Enqueue/send email via Resend using a React Email template matching the event
  3. Both steps wrapped so a failed email send does NOT block the in-app notification
     or the underlying state change (email failure is logged, not fatal)

Templates (React Email, in emails/):
  ComplaintSubmitted.tsx, ComplaintAssigned.tsx, ComplaintUpdated.tsx,
  ComplaintResolved.tsx, SLAWarning.tsx, Escalation.tsx, PasswordReset.tsx

Client:
  - In-app notification bell polls/fetches GET /api/notifications on an interval
    (no websockets needed at this scale — keeps hosting free-tier compatible)
```

---

## 10. File Upload Workflow

```
1. Client requests an upload slot: POST /api/uploads/presign
     body: { fileName, mimeType, sizeBytes, complaintId }
     server: validate mimeType/size (Zod) against allow-list, validate user owns/can
              access complaintId, generate a short-lived R2 presigned PUT URL
2. Client uploads the file directly to R2 using the presigned URL
     (binary never touches our Next.js server — avoids serverless payload limits)
3. On success, client calls POST /api/complaints/:id/attachments
     body: { fileUrl, fileName, mimeType, sizeBytes }
     server: writes an `attachments` document (metadata only) + timeline event
4. MongoDB NEVER stores binary — only fileUrl/fileName/mimeType/sizeBytes, per your spec
```

---

## 11. Analytics Workflow

```
Sources: complaints, complaint_timeline, sla breaches (isOverdue flag)

Aggregation approach:
  - Use MongoDB aggregation pipelines ($group, $facet) rather than pulling raw
    documents into the app layer — keeps the free-tier cluster's CPU/memory load down
  - Cache expensive aggregates (e.g. institution-wide KPIs) for a short TTL
    (in-memory/edge cache or a `analytics_cache` collection refreshed by the same
    hourly cron) rather than recomputing on every dashboard load

KPIs surfaced:
  - Total/open/overdue complaints (institution-wide, by college, by office)
  - Average resolution time vs SLA target
  - SLA compliance % (trend over time)
  - Complaints by category/priority (heatmap)
  - Monthly trend, year-over-year comparison
  - Student satisfaction (average rating) by office

Dashboards:
  - Office Dashboard   → office-scoped queries only
  - Dean Dashboard     → college-scoped queries only
  - QA Dashboard       → institution-wide, read-only
  - Admin Dashboard     → institution-wide + management views

Export:
  GET /api/reports/export?format=csv|pdf&scope=...&range=...
    → role-scoped, generates server-side, streams file (no storage of generated reports)
```

---

## 12. Deployment Architecture (Free Tier Only)

```
Frontend + Backend:  Cloudflare Pages (Next.js on Pages Functions) — preferred for bandwidth
                      [Alternative: Vercel Hobby — simpler Next.js-native cron support]
Database:             MongoDB Atlas M0 (512MB, shared cluster)
File Storage:          Cloudflare R2 (free egress within Cloudflare, 10GB free storage)
Email:                 Resend free tier (3,000 emails/mo, 100/day)
Rate limiting/Cron:    Upstash Redis (free tier) + Upstash Workflow, OR Vercel Cron
                       (Vercel Cron is simplest if hosting on Vercel; if hosting on
                       Cloudflare Pages, Upstash Workflow/QStash triggers the endpoint instead)
DNS/CDN/HTTPS:         Cloudflare (free, automatic HTTPS)

CI/CD:  GitHub → auto-deploy on push to main (Cloudflare Pages / Vercel both support this
        natively, no extra cost)

Environments:
  - Production   (main branch)
  - Preview      (per-PR preview deployments — both platforms support this free)
  - Local        (.env.local, local or Atlas dev database — recommend a separate
                   Atlas M0 project for dev vs prod, still free)
```

**Trade-off to flag now:** If you deploy to Cloudflare Pages, Vercel Cron is unavailable — SLA checks must be driven by Upstash Workflow/QStash hitting `/api/cron/sla-check` on a schedule instead. If you deploy to Vercel Hobby, Vercel Cron is native and simpler, but Upstash is still worth using for rate-limiting either way. I'll ask you to pick one platform before Phase 15 (Deployment), but the code will be written to not hard-depend on either (the cron target is just a normal secret-protected API route).

---

## 13. Environment Variables Checklist

```
# Database
MONGODB_URI=

# Auth.js
AUTH_SECRET=
AUTH_URL=                          # e.g. https://parsu-efeedback.pages.dev

# File Storage (Cloudflare R2 — S3-compatible)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=                      # public bucket URL or custom domain

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=                  # verified sender domain

# Rate limiting / Cron
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=                        # shared secret checked by /api/cron/sla-check

# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=
```

Each of these will be called out again, in context, the first time the relevant module needs it — with exact instructions on where to obtain the value (Atlas dashboard, R2 dashboard, Resend dashboard, Upstash dashboard) and which `.env` file/deployment dashboard to put it in.

---

## 14. Required npm Packages

```
Core
  next  react  react-dom  typescript  @types/react  @types/react-dom  @types/node

Auth
  next-auth@beta (Auth.js v5)  bcryptjs  @types/bcryptjs

Database
  mongoose

Validation
  zod

UI
  tailwindcss  postcss  autoprefixer  class-variance-authority  clsx  tailwind-merge
  lucide-react
  shadcn/ui (CLI-installed components, not a single package)

Email
  resend  react-email   (react-email v6 exports components, Tailwind, and
                          render from one package; the older @react-email/components
                          and @react-email/render are deprecated — import
                          everything from "react-email")

File Storage
  @aws-sdk/client-s3  @aws-sdk/s3-request-presigner    (R2 is S3-compatible)

Rate limiting / Background jobs
  @upstash/redis  @upstash/ratelimit  @upstash/workflow   (or @upstash/qstash, depending
  on final cron approach chosen in Phase 15)

Charts/Analytics UI
  recharts

Dev tooling
  eslint  eslint-config-next  prettier  prettier-plugin-tailwindcss
  @typescript-eslint/parser  @typescript-eslint/eslint-plugin

Testing
  vitest  @testing-library/react  @testing-library/jest-dom  playwright
```

Exact versions will be pinned when we hit Phase 3 (Dependency Installation) so they're current at that time rather than potentially stale here.

---

## 15. Development Roadmap — MVP to Production

```
Phase 1   Project initialization           create-next-app, TS strict, repo, base configs
Phase 2   Folder structure                 scaffold structure above, no logic yet
Phase 3   Dependency installation           install + pin all packages above
Phase 4   Environment variables             .env.example, document every var, local setup
Phase 5   Database connection               lib/db.ts singleton, connect to Atlas M0,
                                            create Mongoose models (no business logic yet)
Phase 6   Authentication                    Auth.js credentials + JWT, role in token,
                                            login/register/reset-password pages
Phase 7   User management                   admin CRUD for users/offices/categories
Phase 8   Complaint module                  submission, tracking, timeline, notes,
                                            status lifecycle (core MVP feature)
Phase 9   Routing engine                    routing_rules evaluation on submit
Phase 10  SLA monitoring                    sla_rules, slaResponseDueAt/slaResolutionDueAt computation, cron endpoint
Phase 11  Notifications                     in-app + Resend email templates
Phase 12  File uploads                      R2 presign flow, attachments
Phase 13  Analytics                         aggregation pipelines, dashboards per role
Phase 14  Reports                           CSV/PDF export
Phase 15  Deployment                        pick Cloudflare Pages vs Vercel, configure
                                            Upstash/Vercel Cron, go live on free tiers
Phase 16  Testing                           unit (services), integration (API routes),
                                            e2e (critical flows: submit → resolve → rate)
Phase 17  Optimization                      index review, query profiling, bundle size,
                                            caching pass on analytics endpoints

MVP cut line: Phases 1–11 (auth, complaints, routing, SLA, notifications) constitute
a usable MVP. Phases 12–17 take it from MVP to the enterprise-grade, analytics-rich
system described in your spec.
```

---

## Open Questions Before We Start Building

1. **Hosting platform:** Cloudflare Pages or Vercel Hobby? This affects how the SLA cron is triggered (Upstash Workflow vs native Vercel Cron) and is worth locking in early even though Phase 15 is deployment, since it shapes the cron endpoint's design from Phase 10 onward. *Still open — needed by Phase 10 at the latest.*
2. ~~**ERD/Business Rules/Data Dictionary**~~ — **Resolved in Phase 5.** BR-001…BR-100 were provided and reconciled into the schema above; see `docs/schema-reconciliation.md` for the full diff (two new collections, several renamed/added fields).
3. **Auth.js version:** Auth.js v5 (beta but stable, Next.js 15-native) vs NextAuth v4 (mature, but awkward with App Router). I'd recommend v5 — confirm you're fine with that before Phase 6. *Still open — needed by Phase 6.* (`package.json` already has `next-auth@beta`, i.e. v5, pinned from Phase 3, so this is really just a confirm-or-object checkpoint.)
