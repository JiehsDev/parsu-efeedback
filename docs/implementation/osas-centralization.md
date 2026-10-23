# Centralized OSAS handling

This implementation note describes the application change. Thesis/research documents are unchanged.

## Roles and access

- OSAS is the only handling office. Categories classify complaints and never choose another queue.
- OSAS Head authority comes from `Office.headUserRef === user._id`, with role `osas` or `office_staff`. The head assigns OSAS staff, handles personally, changes assignees with a reason, supervises SLA and archive requests, and processes personally assigned complaints.
- Ordinary OSAS staff can view every complaint in their office, including resolved, closed, and archived records. They can process, request information, upload attachments, write internal notes, resolve, and release with a reason only when assigned as the handler. No pickup, delegation, or transfer.
- VPAA/VPAF have global **read-only** oversight. Existing category-to-office routing was not a reliable domain mapping; category domains are explicit classification metadata now, but role-specific domain scoping is deliberately not enabled. Both oversight roles can filter, inspect analytics, and generate/export reports. Processing APIs independently deny them, including notes, uploads, archives, and assignment changes.
- Main Administrator retains configuration, users/offices, global visibility, reporting, and archive/restore. Pre-existing emergency backend overrides remain for processing/assignment/reopening; the normal administrator interface offers archive administration, not staff workflow controls.
- Students retain own-ticket access and their existing information, attachments, withdrawal, and optional rating/closure workflows. Handler views show student ID and college rather than student name.

## Lifecycle and escalation

New tickets are `submitted` and have no individual assignee. OSAS Head assignment or Handle Personally starts `in_progress`. Information requests use `pending_information`; a student response returns to `in_progress`. Resolution is `resolved`, followed by student confirmation with or without a rating to `closed`. Withdrawal remains supported before handling. Release returns the complaint to the OSAS `submitted` queue.

Office transfer APIs deny every role. Internal escalation assigns the OSAS Head and sets `supervisorReviewRequired`; it does not create a new lifecycle status or move offices. Pending information remains pending. SLA breach marks overdue and requests OSAS supervisory review. Legacy SLA `escalateToOfficeRef` and office `parentOffice` never drive operational escalation. Missing head configuration does not cause external fallback.

## Configuration and reporting

Category names, descriptions, identifiers, and priorities are retained. `Category.domain` is explicit metadata (`academic`, `administrative`, `finance`, `facilities`, `student_services`, `ict`, `health`, `other`). Seed classifications are taken from the previous official category groups. Unknown/custom categories remain available as `other`.

New category setup creates OSAS compatibility routing and a configurable SLA. Routing APIs normalize destination and conditions to OSAS; SLA APIs clear external escalation targets. Reports support category, domain, priority, date, status, and SLA state plus response/resolution-hour columns. The dashboards show category/domain distributions and service metrics rather than operational office comparisons.

## Development data

`node scripts/centralize-osas.cjs` previews the migration. `--apply` writes an Extended JSON snapshot under ignored `.local-backups/`, centralizes category/routing metadata, clears external SLA escalation targets, and moves active non-archived complaints to OSAS. Valid OSAS assignees survive; invalid assignees are cleared. Legacy assigned/escalated statuses normalize to in-progress or submitted. Closed, resolved, withdrawn, and archived complaint records are unchanged. Existing histories are preserved; migration adds assignment, timeline, and audit entries. Optimistic update filters skip concurrently edited complaints. Rerunning the migration is safe. Production execution is disabled.

The dev seed endpoint is a separate, explicitly destructive **ticket reset**, never a migration. It preserves/upserts account and configuration IDs, official/custom categories, and reference office metadata; it creates zero complaints and clears complaint-dependent demo history/notifications. It does not generate processing accounts for ICTO/HSU or other reference offices. Run browser tests against an isolated database, not a working development database containing tickets.

## Compatibility retained

`assigned` and `escalated` enum values, office references, routing-rule records, SLA escalation fields, and old assignment event types remain readable for historical records. The former office-transfer service/endpoint remains as an explicit denial for old clients. Institutional office records remain for student college identity and reference metadata. TAM/SUS evaluation functionality is untouched.

## Verification environment

Browser verification uses an isolated temporary MongoDB database and a local Next server. It does not reset the configured development database. The six-role authentication setup plus the centralized assignment/oversight browser scenario passed (7 tests). The configured development database migration was applied separately with a backup; post-migration checks found zero active categories/routes/complaints outside OSAS and zero external SLA escalation targets.

On low-disk local machines, the test harness accepts `MONGO_TEST_MIN_DISK_MB=64` to lower MongoDB's index-build free-space admission threshold for the temporary test instance only. The default MongoDB threshold remains unchanged when this variable is absent. Model indexes are explicitly initialized before uniqueness assertions, and database hooks allow up to 30 seconds for local startup.
