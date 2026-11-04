# Analytics demonstration data

The explicit analytics seed adds synthetic complaints to the configured database. The ordinary development configuration seed remains ticket-free.

```powershell
# Preview without writing
npm.cmd run seed:analytics
# Append the dataset
npm.cmd run seed:analytics -- --apply
```

Requires Node.js 24, a MongoDB replica set supporting transactions, active OSAS/OVPAA/OVPAF offices with their designated heads, at least two active colleges, and configured active categories/SLA rules. It reuses those records without updating them.

The dataset contains 180 complaints across six months with increasing monthly volume. The current database has five colleges and 29 active categories, all represented. Fifteen inactive synthetic student accounts supply college comparisons; their random password hashes have no published credentials. Tickets begin `DEMO-ANALYTICS-`, titles begin `[DEMO]`, descriptions explicitly identify synthetic records, and imported histories/audit records are labeled as simulations.

The examples cover all eight existing complaint statuses, configured priorities, all three handling offices, early/late resolutions, unresolved overdue complaints, first-response and resolution durations, ratings from 1–5, closure without rating, archived cases, and pending information requests. No category priorities or SLA rules are changed to manufacture chart diversity. SLA policy snapshots and dates use the existing Philippine weekday/holiday calendar.

Every complaint has an initial OSAS intake assignment. Examples held by VPAA/VPAF also have simulated approved forwarding requests, OSAS Office Head review, forwarding timeline entries, and assignment histories. Category selection alone does not grant receiving-office visibility. No live forwarding operations, notification delivery, or emails are triggered by this import.

All inserts occur in one transaction. Existing data is neither deleted nor updated. A local append manifest under `.local-backups/analytics-demo/` lists inserted IDs and hashes of existing records; hashes are checked after insertion. Stable IDs, distinct ticket numbers, and an audit manifest make repeated runs no-ops, preserving any later edits to demo records. The dataset's dates stay fixed after its first successful import.

Use the administrator **Analytics/Reports** views to explore monthly trends, category and priority distributions, domain and college comparisons, SLA performance, response/resolution times, and ratings. VPAA/VPAF reports display only their formally forwarded examples. Report date, category, college, office, status, priority, domain, and SLA filters operate on the regular complaint records.

Implementation: `scripts/seed-analytics.cjs`, the `seed:analytics` package command, and `src/features/seed/analytics-demo.integration.test.ts`. No application schemas, analytics calculations, workflows, or access-control services are changed.

## Applied dataset (2026-11-04)

- Added 180 synthetic complaints and 15 inactive demo students. The original 18 complaints remain intact: 198 total.
- June–November 2026, all 29 active categories, all five colleges, and three handling offices; 43 complaints have labeled approved forwarding histories.
- Statuses: 59 closed, 30 resolved, 15 in progress, 16 awaiting information, 17 assigned, 15 submitted, 14 escalated, and 14 withdrawn. Four completed OSAS cases are archived.
- Among the 176 unarchived examples: 16 late resolutions, 60 overdue open cases, 23 rated closures, and 33 closures without a rating. Priorities follow existing categories: 116 medium, 34 high, and 26 low. No new critical category was invented.
- Existing records in every affected collection passed before/after hash checks. Repeated apply returned `alreadySeeded: true` without writing.
- Append manifest: `.local-backups/analytics-demo/analytics-demo-1793773185542-ef576103-3dcc-4e68-ba0d-b6e5532c0752.json`.

Verification: 19 tests passed across four integration files. The new transaction-backed test validates every inserted model/reference, date and SLA invariants, OSAS intake and forwarding histories, populated analytics, role-scoped reporting, category/SLA filters, preview preservation, and repeat-seed idempotence. Existing analytics, report-data, and ticket-free development-seed tests also passed. TypeScript and targeted ESLint passed. Live read-only aggregation verified the counts above. This task did not rerun browser or production-build checks because it changes only the explicit seed command, fixtures, and documentation.
