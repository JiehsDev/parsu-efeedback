# Complaint category catalog update

This update changes category classification and configuration only. Intake, assignment, forwarding authorization, receiving-office access, analytics, and complaint histories retain the existing centralized OSAS workflow.

## Requested OSAS categories

1. Guidance and Counseling Services � counseling appointments, guidance, follow-up, and referrals.
2. Dormitory and Accommodation � facilities, accommodation, maintenance, cleanliness, and fee concerns.
3. Medical and Dental Services � clinic services, medical assistance, dental services, and clinic concerns.
4. Food and Canteen Services � food quality, sanitation, facilities, and service concerns.
5. Library Services � facilities, schedules, resources, borrowing, and library services.
6. Scholarships and Financial Assistance � applications, eligibility, requirements, assistance, and processing.
7. Student Organizations and Activities � Student Council, publications, organizations, culture, and sports.
8. Student Assistantship and Incentives � applications, compensation, incentives, eligibility, and benefits.
9. Student Conduct and Peer-Related Concerns � conflicts, disrespectful behavior, bullying and harassment reports, and peer concerns. This is a **proposed reporting category**, not a statement of university disciplinary policy.
10. Other Student Services Concerns � student services not covered by another category.

The service taxonomy follows the task's supplied handbook-based list. No disciplinary provisions, eligibility rules, sanctions, or benefit entitlements are inferred from those examples.

`Campus Safety & Security` and `Student Services & Assistance` remain available. The existing health, scholarship, and peer-concern categories are renamed in place using explicit aliases; their IDs, complaint references, configured priorities, SLA rules, and active/inactive states are preserved. Ambiguous aliases cause a preflight error rather than an automatic merge.

## Recovered original categories

The authoritative project evidence is Git commit `12fe619`, `src/app/api/dev/seed/route.ts`, the `additionalCategories` entries whose original receiving offices were `ovpaaOffice` and `ovpafOffice`. Existing generated office/account guides corroborate this mapping. The pre-cleanup EJSON configuration backup `.local-backups/non-osas-cleanup-1792720853751.json` preserves the category IDs and SLA settings.

| Group | Original name                      | Original description                                                               | Priority | Recovered category ID      |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------- | -------- | -------------------------- |
| VPAA  | Curriculum & Class Scheduling      | Class scheduling conflicts, overcrowded sections, missing prerequisite subjects    | medium   | `6ad241a70973070a28daa440` |
| VPAA  | Academic Advising & Consultation   | Faculty unavailability during posted consultation hours, lack of academic guidance | low      | `6ad241a70973070a28daa443` |
| VPAA  | Library Services & Resources       | Limited access to references, inconsistent library operating hours                 | low      | `6ad241a80973070a28daa446` |
| VPAF  | Student Payment & Cashier Concerns | Tuition payment posting delays, fee assessment discrepancies                       | medium   | `6ad241ab0973070a28daa455` |

All four were recovered in the initial update. The later requested expansion below adds the explicitly supplied service categories. Historical college-specific faculty categories, registrar categories, and other deactivated classifications are not automatically reactivated. The OSAS `Library Services` and original VPAA `Library Services & Resources` remain separate as explicitly requested.

Existing category IDs always win over backup IDs. Historical IDs are reused only for absent records and only if unoccupied. The recovered SLA rule IDs are similarly reused for missing rules. Restored missing rules use the recovered/current 72-hour response and resolution settings; existing configured SLA records are never overwritten, nor are complaint deadlines recalculated.

## Existing installations

Use Node.js 24, consistent with the repository's existing TypeScript-backed migration scripts. From the project root, preview the configured database without writing:

```powershell
npm.cmd run migrate:categories
```

After reviewing the category identities, actions, and warnings, apply:

```powershell
npm.cmd run migrate:categories -- --apply
```

The command loads the existing environment configuration. It requires an active OSAS office and writes an EJSON configuration backup under `.local-backups/category-catalog/` before any changes. It only writes `categories`, `routing_rules`, and `sla_rules`; it never writes complaints, forwarding requests, assignments, histories, users, offices, attachments, notifications, or audit records.

New categories are provisioned as drafts and published after their routing and SLA records exist. An interrupted provisioning attempt fails safely as an inactive category, which an administrator can inspect and activate after configuration is complete. Existing inactive categories and inactive rules are not automatically reactivated, except for the explicitly requested legacy Grade Concern restoration described below. Later deactivation of the canonical Grades and Academic Assessment category is respected. Missing active configuration with retained inactive rules is reported for administrator review.

Every new active routing configuration targets OSAS. Existing active target configurations for catalog categories are corrected to OSAS without changing complaint ownership. There is no category-based forwarding, reassignment, access grant, or deadline reset. Current priority, SLA durations, thresholds, and historical rule records are preserved.

The focused migration adds the requested/recovered catalog and preserves the two existing OSAS categories. It does not add the six generic classifications from the old development seed to existing installations. Custom categories remain untouched.

Repeated migration runs produce no additional records and no configuration changes when already current. Never use the legacy centralization or cleanup scripts for this category-only update: those scripts have broader historical responsibilities.

## New development environments

The development seed now calls the same category provisioner, adds the old generic seed classifications, and does **not** delete or generate complaint data. Fresh environments start with zero tickets; repeat seed runs preserve existing complaints and histories. Development account/office provisioning remains the existing seed's responsibility, so use the focused migration for category-only updates to existing installations.

## Interface and model changes

- `src/models/Category.ts`: nullable `group` enum (`osas`, `vpaa`, `vpaf`). No new category collection or ownership field.
- `src/lib/category-groups.ts`: classification values and display labels; no authorization logic.
- `src/features/seed/categories.ts`: requested catalog, documented aliases, recovered IDs, and preserved generic development categories.
- `scripts/migrate-complaint-categories.cjs`, `package.json`: preview/apply command, scoped configuration backup, idempotent upserts, and collision checks.
- `src/features/seed/seed.service.ts`, `scripts/seed-demo.cjs`: non-destructive configuration seed and updated retired demo-seed guidance.
- `src/features/admin/schemas/category.schema.ts`, `src/app/api/categories/route.ts`: validate classification for administrator writes; return active categories without internal office-group/ownership metadata from the student-facing endpoint. Existing administrator guards remain unchanged.
- `src/app/admin/categories/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `src/components/admin/EditCategoryButton.tsx`: grouped listings, visible descriptions, and classification management using existing components.
- `src/app/student/complaints/new/page.tsx`, `src/components/ui/select.tsx`: an alphabetical category list using the existing Radix select, with no office-group labels; selected descriptions remain visible. Administrative grouping remains available.
- `src/features/seed/category-catalog.integration.test.ts`, `src/features/seed/demo-seed.integration.test.ts`, `src/features/seed/cleanup-non-osas.integration.test.ts`, `src/features/complaints/centralized-osas.integration.test.ts`, and `tests/ui-audit/category-catalog.spec.ts`: migration, preservation, authorization, submission, and UI verification.
- `docs/implementation/category-catalog.md`, `docs/implementation/controlled-forwarding.md`: migration instructions, recovered configuration provenance, and updated seed documentation.

`RoutingRule` and `SLARule` schemas are unchanged; their existing collections receive only required catalog configuration. `Complaint`, `ForwardingRequest`, permission services, forwarding services, assignment routes, analytics, and deadline calculation code are unchanged.

## Initial update verification

- Targeted automated run: 80 tests passed across 11 files, covering catalog migration/idempotence, identity collisions, inactive-state preservation, customized priorities/SLA, protected records, category management, active student selection, centralized intake, forwarding authorization, receiving-office access, SLA calculation, and administrator scoping.
- Production build: passed, including TypeScript checking.
- Targeted ESLint: passed.
- Production-browser regression: passed against the optimized production build. Verified category selection, original descriptions, VPAF-category submission into OSAS, administrator group search, category creation/SLA setup, and group editing. Student-facing category responses and options omit office groups. Category workspace checks passed at 1440, 768, and 390 pixels.
- Browser assertions deliberately cover category content. An existing student navigation overflow at 768 pixels was observed and left unchanged under the category-only scope.
- First-run seed initialization now awaits model indexes before configuration upserts. The browser audit passes with this startup safeguard.

## Applied database migration (2026-10-29)

The category-only migration was applied to the configured application database after the automated checks and production browser regression passed.

- Created 11 category records: seven new OSAS services and the four recovered VPAA/VPAF records.
- Updated five existing OSAS records: three in-place renames and classification metadata for the two retained categories.
- Reused all existing category IDs and the four recovered historical category/SLA IDs.
- Final catalog: 18 categories total, 16 active; both previously inactive categories remain inactive.
- SHA-256 preservation checks confirmed all 17 non-configuration collections unchanged, including all 18 existing complaints, users, offices, histories, assignments, forwarding requests, notifications, and audit records.
- Existing SLA configuration documents remained unchanged (EJSON hash comparison).
- A second apply run created or modified zero categories, routes, or SLA rules. Configuration hashes also remained unchanged.
- Configuration backup: `.local-backups/category-catalog/category-catalog-1793278340312-afc00d2d-32f4-4390-af14-38f8cbb0e0e3.json`.
- Verification evidence: `.local-backups/category-migration-result.json`.

No category from the original direct OVPAA/OVPAF lists remains unrecovered. No application database reset or complaint fixture generation was performed.

## VPAA and VPAF expansion (2026-11-04)

The existing group field provides office classification; defaultOfficeRef and routing rules continue to target OSAS. Student options and API responses continue to omit office-group labels. No schema, permission, workflow, reporting, or UI component changes are needed.

### Requested VPAA categories

- Teaching and Instruction Concerns
- Faculty-Related Academic Concerns
- Academic Policies and Procedures
- Grades and Academic Assessment
- Curriculum and Course Concerns
- Academic Scheduling
- Academic Support Services

### Requested VPAF categories

- Campus Facilities and Maintenance
- Financial and Payment Concerns
- Administrative Services
- Campus Safety and Security
- Buildings, Classrooms, and Equipment
- Sanitation and Campus Environment
- University Infrastructure and Utilities

### Reuse and preservation

The migration reuses Student Payment & Cashier Concerns as Financial and Payment Concerns, preserving category ID `6ad241ab0973070a28daa455`, its SLA record, and existing priority. It reuses the inactive Grade Concern record as Grades and Academic Assessment, preserving ID `6ad241a00973070a28daa41c`. The latter is explicitly restored to active status to satisfy the requested availability; unrelated disabled categories remain disabled. Restoration applies only while the legacy alias is present, so rerunning does not undo later administrator deactivation of the canonical grade category.

The three previously restored VPAA categories remain available with their IDs, descriptions, and configurations. Their combined scheduling/curriculum and specialized advising/library scopes are retained rather than splitting, merging, or deleting historical records. All twelve existing OSAS records remain unchanged. VPAF Campus Safety and Security describes institutional security services, access controls, and infrastructure; the existing OSAS Campus Safety & Security continues to describe student safety assistance and incidents.

New records use medium, the existing category creation default, and DEFAULT_SLA_HOURS from the shared constants. Existing priorities, SLA durations, warning thresholds, escalation configurations, and complaint deadlines are retained. Administrators can edit the resulting records with the existing forms. Category filtering uses categoryRef, and analytics joins those same IDs, including after an in-place rename.

### Files in this expansion

- src/features/seed/categories.ts: seven requested categories per office, descriptions, legacy aliases, and preserved catalogs; consumed by both development seed and existing-installation migration.
- scripts/migrate-complaint-categories.cjs: explicit restoration of the legacy grade alias while respecting subsequent deactivation.
- src/features/seed/category-catalog.integration.test.ts: all fourteen categories, protected records, OSAS preservation, identity reuse, filtering/analytics, custom SLA settings, and OSAS-only submissions.
- tests/ui-audit/category-catalog.spec.ts: updated category names and availability assertions for the expanded list.
- docs/implementation/category-catalog.md: expansion and verification report.

The existing preview/apply commands above install this expansion without resetting a database or generating complaints.

### Expansion verification and applied migration

- 75 distinct automated tests passed across 10 files (57-test initial run, 24-test SLA/activation run with catalog overlap, then the final eight catalog regressions). Coverage includes all fourteen student submissions, OSAS-only intake, receiving-office exclusion, forwarding authorization and history, seed preservation, category activation, filtering/analytics, and SLA rules/recalculation.
- TypeScript, targeted ESLint, and the production build passed.
- Applied the scoped migration to the configured application database: 12 new records, two reused/renamed records, 13 new routing rules and 13 new SLA rules. Final count is 30 categories, 29 active; the unrelated Internet and Network record remains inactive.
- Before/after EJSON hashes confirmed all 17 non-configuration collections unchanged, including all 18 existing complaints. All existing category IDs, all twelve OSAS category documents, and all existing SLA documents were preserved.
- Repeated apply produced zero category, route, or SLA writes; configuration hashes were unchanged.
- Backup: `.local-backups/category-catalog/category-catalog-1793772243747-65bbe569-876e-495d-aadb-bf7a7ea7dd7d.json`.
- Preservation and idempotence evidence: `.local-backups/vpaa-vpaf-expansion-result.json`.

The production-browser regression passed at 1440, 768, and 390 pixels: all fourteen names were available, options had no office labels, a payment-category submission entered OSAS, and administrator group search, category creation with SLA, and editing worked. The harness then encountered a Windows EBUSY lock while deleting temporary MongoDB diagnostic files; the remaining audit process was stopped and temporary TypeScript configuration entries were removed. Browser assertions passed; automated teardown did not complete cleanly.

Browser verification runs against a disposable database; no test complaints are generated in the configured application database. External deployed environments are outside this local verification.
