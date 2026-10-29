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

All four were recovered. No additional VPAA or VPAF categories were invented. Historical college-specific faculty categories, registrar categories, and other deactivated classifications are not automatically reactivated. The OSAS `Library Services` and original VPAA `Library Services & Resources` remain separate as explicitly requested.

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

New categories are provisioned as drafts and published after their routing and SLA records exist. An interrupted provisioning attempt fails safely as an inactive category, which an administrator can inspect and activate after configuration is complete. Existing inactive categories and inactive rules are not automatically reactivated. Missing active configuration with retained inactive rules is reported for administrator review.

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

## Verification

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
