# OSAS architecture update delivery

## 1. Files modified

See [the complete file manifest](osas-centralization-files.md). The main modules are `src/lib/osas-operations.ts`, `src/lib/complaint-access.ts`, `src/lib/admin-scope.ts`, routing and assignment services/APIs, shared complaint detail/actions/dashboard components, reporting services, seed service, migration, and authorization tests.

## 2. Roles and permissions

OSAS Head uses `Office.headUserRef` and can assign OSAS staff, Handle Personally, change assignee with a reason, supervise archives, and process personally assigned complaints. Ordinary OSAS staff cannot pick up or delegate; they see/process their own assignments and can release with a reason. VPAA/VPAF are read-only oversight users. Main Administrator retains configuration, users/offices, global reporting/visibility, and archive/restore; existing emergency backend overrides are retained but not presented as normal processing controls.

## 3. Routing

All categories resolve to active OSAS through a shared service, regardless of old category destination or rule conditions. Active compatibility routing records and category default offices are centralized. All 40 existing category records remain available. ICTO/HSU and college/university offices remain reference metadata, not operational queues.

## 4. Escalation

Manual and SLA escalation remain within OSAS and target the OSAS Head. `supervisorReviewRequired` records supervisory review without introducing a new lifecycle state. Legacy hierarchy and external SLA escalation targets do not drive processing. Office reassignment is denied at API/service boundaries for every role, including Main Administrator.

## 5. Seed

The development seed upserts stable users, offices, categories, routing, and SLA configuration. It creates zero complaints and clears complaint-dependent demo records. It provides OSAS Head, OSAS staff, VPAA, VPAF, Main Administrator, and students. It no longer creates operational ICTO/HSU users. The seed's zero-ticket result and repeatability were verified against isolated databases; the configured development database was migrated rather than reset.

## 6. Dashboard and UI

Shared complaint views enforce access before loading related information. VPAA/VPAF have no processing panel or operational action buttons. OSAS Head has Assign Staff, Handle Personally, Change Assignee, archive supervision, and personally assigned workflow controls. Ordinary staff cannot see pickup/delegation/transfer controls. Dashboards show complaint totals, SLA, unassigned work, response/resolution metrics, satisfaction, trends, category distribution, and service domains. The assignment modal now has an accessible dialog role.

## 7. Backend authorization

Assignment, status/resolution, information requests, notes, uploads, release, archive/review, reopen, and escalation all enforce the new permissions independently of the UI. Staff list/detail/analytics/report access is constrained to assignments, with head-level queue visibility. Notifications and old report downloads recheck current access. Student ownership and identity protections remain.

## 8. Migration

Applied `node scripts/centralize-osas.cjs --apply` to the configured development database after preview. One active complaint migrated; zero concurrent changes were skipped. The migration wrote a typed Extended JSON backup to ignored `.local-backups/osas-migration-1792604064736.json`. It preserves closed/archived complaint records, existing audit/history, and valid OSAS assignees; it clears invalid assignees and appends migration events. A repeat preview found zero remaining active complaint migrations.

Post-migration verification: zero active categories outside OSAS; zero active routing rules outside OSAS; zero active complaints outside OSAS; zero external active SLA escalation targets.

## 9. Tests

Added 19 architecture integration scenarios for category-independent routing, VPAA/VPAF mutation denial, oversight analytics/reports, head assignment/personal handling, staff pickup denial, assignment scope, release, internal escalation, SLA, migration safety/idempotency, and zero-ticket seed behavior. Updated routing, assignment, transfer-retirement, lifecycle, release, notes, head eligibility, report column/filter, and oversight tests. Test setup waits for model indexes before uniqueness assertions.

## 10. Validation results

- Production build: passed.
- TypeScript: passed.
- Lint for modified implementation/test files: zero errors, zero warnings.
- Regression assertions: all 296 passed across the full run and an explicit attachment-suite retry. The full run recorded 289 passes with seven attachment cases left pending; their separate run passed all seven. No failed assertions remain. Earlier runs encountered local disk-space limits and index-startup timing; these are not counted as passing checks.
- Browser verification: seven passed (six role logins plus the centralized assignment/oversight UI scenario), against an isolated temporary database. The entire legacy browser suite was not run.
- All 19 new architecture integration scenarios passed.
- Git diff whitespace check: passed.

The local regression run used `MONGO_TEST_MIN_DISK_MB=64` for temporary MongoDB index-build admission only. Application/production database settings were unchanged. An attempted combined server/cache cleanup was blocked by automatic review; no cache was deleted. The isolated server was subsequently stopped separately and its temporary database closed normally.

## 11. Compatibility limits

VPAA/VPAF currently have global read-only oversight rather than academic/administrative domain restrictions, as explicitly permitted where the old mapping is unreliable. Category domains are now available for filtering, analytics, and reports; role-specific domain scoping can be enabled later from explicit data. Historical closed/archived complaints retain their original office references. Cloud report storage/email delivery were mocked in integration tests; external delivery was not certified. The complete older browser suite has not been certified against this architecture.

## 12. Code retained for migration/history

Legacy assigned/escalated enum values, office references, routing/SLA fields, office hierarchy metadata, and old assignment event types remain readable for existing records. The old office-transfer and pickup UI exports are inert; office-transfer API/service entry points explicitly deny old clients. Research/thesis documents and TAM/SUS evaluation features were not changed.
