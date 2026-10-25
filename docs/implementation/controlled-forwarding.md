# Controlled complaint forwarding — 25 October 2026

This replaces the OSAS-only / globally read-only VPAA/VPAF design. Every new complaint starts at OSAS. VPAA and VPAF see and process only complaints formally forwarded to their current office by the OSAS head.

## Ownership and permissions

`assignedOfficeRef` remains the current responsible office. `initialOfficeRef`, `forwardedToRole`, and `forwardedAt` record receipt and formal forwarding. Receiving-office access requires the correct current office **and** forwarding marker; legacy direct office assignments grant no access. Student ownership and masked student identifiers are unchanged.

OSAS colleagues retain office-wide reading while a complaint belongs to OSAS. Only its assigned handler processes it. Staff can request forwarding to VPAA/VPAF; they cannot approve, transfer directly, or choose arbitrary offices. The OSAS head is identified through `Office.headUserRef`, including when that account has the `office_staff` role. Only that head may approve, reject, or directly forward. Main Administrator retains global access but cannot bypass the head's forwarding decision.

The existing VPAA/VPAF accounts are receiving handlers. Existing OVPAA/OVPAF office records are reused. Approval selects that office's active head account with the matching role, or the sole active account of that role. Ambiguous or inactive receiving-account configuration blocks approval rather than silently choosing someone.

Receiving users may request information, add notes/attachments, change allowed statuses, and resolve their assigned forwarded cases. Student information responses resume processing in the same receiving office. Student confirmation and optional rating continue unchanged. Archive administration retains its existing head/admin restrictions. Reopening preserves current ownership; no return-to-OSAS action is introduced.

## Requests, persistence, history, and notifications

`ForwardingRequest` records complaint, source/destination, requester, reason, timestamps, decision, reviewer, and decision note. A partial unique database index enforces one pending request per complaint. Pending requests leave ownership unchanged. Rejection requires a reason and preserves ownership and assignment.

Approval commits the request decision, complaint ownership/receiver assignment, append-only assignment history, timeline, audit records, and in-app notifications in one MongoDB transaction. Failed approvals roll back. Existing assignment records remain intact. MongoDB must support transactions (replica set or sharded deployment); the configured development database was checked separately.

The previous OSAS assignment is replaced by assignment to the existing receiving handler, with the prior handler preserved in history and audit. Submission time, first-response history, SLA policy, response deadline, and resolution deadline are not reset. An outstanding information request stays open after forwarding; the student response resumes work with the receiving handler. A pending archive request must be decided before a new forwarding request.

Requests notify the OSAS head. Approval notifies requester, receiver, and student. Rejection notifies requester. Requester decision notices do not carry an inaccessible complaint link after ownership moves. Normal receiving-office status/information notifications use the same access checks as complaint views. These are persisted in-app forwarding notifications; forwarding-specific email delivery is not added.

## Queries, reports, and UI

Shared access filters protect complaint APIs, server-rendered detail pages, search, dashboard counts/tables, analytics, notifications, and exports. Scoped downloads and print views rebuild from current permissions, including older stored reports. OSAS head reports retain initially received / forwarded history; ordinary staff reports remain current-office only. Exports include forwarding destination and timestamp.

Staff details show Request Forwarding with destination and reason. Head details show Forward Complaint, or a pending request with Approve/Reject. Approval requires confirmation. Both OSAS navigation variants expose Forwarding Requests, which retains request/decision history after forwarding. Receiving dashboards show their own workload and processing actions. OSAS dashboards include pending requests and forwarding totals. Forwarding is named separately from assignment and changing assignee.

## Seed and development migration

The authenticated `/api/dev/seed` remains an explicit ticket reset: it creates accounts, offices, categories, and rules with **zero complaints** and zero forwarding requests. It preserves existing/custom categories and adds missing academic, administrative, finance, ICT, facilities, and other classifications. All categories initially route to OSAS. The old additive `seed:demo` ticket generator is retired and refuses to insert tickets.

`node scripts/migrate-forwarding.cjs` previews changes. `--apply` writes backups under `.local-backups`, centralizes active legacy complaints and category routes, clears invalid legacy assignments, links existing receiving accounts/offices, installs the pending-request constraint, and increments VP token versions once. It never resets tickets, removes history, fabricates approved forwarding, or moves formally forwarded cases back to OSAS. Closed/archived legacy records remain historical; Main Administrator can still read them. The older centralization migration now skips formally forwarded cases too.

VP users must sign in again after the account migration. Existing browser data is held only in memory; new authorization is enforced at every backend request. Already viewed/downloaded data cannot be recalled.

## Verification

- Backend and regression verification: **115 tests passed across targeted runs**. This includes 13 controlled-forwarding integration tests plus initial routing, complaint permissions, scoped reports/dashboard analytics, notifications, seed behavior, status transitions, navigation, and themes. A consolidated run hit MongoDB's local disk-space threshold; its remaining 17 tests passed when rerun separately. This is targeted coverage, not a claim that the entire legacy test suite was run.
- Production build: passed (`npm run build`), including Next.js TypeScript compilation. Separate `npm run typecheck` also passed.
- Modified-file lint and `git diff --check`: passed. Final build/typecheck checks include the browser-harness adjustments.
- Development migration: previewed and applied with backups. Existing receiving accounts/offices were linked, their sessions invalidated, and the pending-request index installed. No ticket reset was performed. A repeat preview found no active complaints requiring relocation. The configured database supports transactions.
- Browser verification: **2 production-build scenarios passed (1.6 minutes)**, one each for VPAA and VPAF. These verify search/direct-URL denial before forwarding, assigned-staff requests without approval controls, the head request queue, approval, rejection with unchanged ownership, separation of receiving offices, unchanged SLA deadlines, receiving-handler information requests, student responses, resolution, and closure without rating. Earlier development-server attempts failed because Fast Refresh cleared forms; the successful run used the production build with an isolated replica-set database and blocked external email delivery. The older six broad UI-audit scenarios were not rerun as part of this architecture verification.

To repeat the successful browser check in PowerShell after `npm run build`:

```powershell
$env:UI_AUDIT_USE_BUILD="1"
npm.cmd run test:ui-audit -- --grep "controlled forwarding"
```

The runner seeds only its temporary development database, stops its temporary development server, then starts the production build against that same database. The production seed endpoint remains disabled. It never seeds the configured application database.

## Operational limits

Forwarding-specific notifications are in-app. The receiving office must have an active matching head account or exactly one active account of its receiving role. Existing archive and reopening authority remains restricted to the administrator/OSAS head; forwarding does not grant receiving handlers those administrative powers. The request queue currently shows the latest 100 matching requests. Previously downloaded files cannot be recalled when access changes.

## Changed-file inventory

Core changes are in `src/features/forwarding/forwarding.service.ts`, `src/models/ForwardingRequest.ts`, `src/models/Complaint.ts`, `src/lib/admin-scope.ts`, `src/lib/osas-operations.ts`, `src/lib/complaint-access.ts`, and `src/lib/report-complaint-scope.ts`.

New API routes: `/api/complaints/[id]/forwarding`, `/api/forwarding-requests`, `/api/forwarding-requests/[id]`. Existing complaint lists/status/attachments/uploads/reopening, report export/download/print, and notification recipient checks use the revised rules.

UI: `ForwardingPanel`, `ForwardingRequestsPage`, shared complaint detail/actions/history, both OSAS navigation components, dashboards, and student resolution copy. Persistence also updates assignment/timeline/notification enums and indexes. Seed, migration, isolated replica-set runner, backend integration tests, and UI audit scenarios are updated with the workflow.

The uncommitted UI-accessibility audit changes from the earlier task remain in this workspace; they are not discarded by this architecture update.
