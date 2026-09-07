# Role Restructuring & Office Classification — Design

Date: 2026-09-07
Status: Approved for planning

## Summary

Four related changes to ParSU e-Feedback's role and office model:

1. Remove the `college_dean` role entirely; colleges become staffed like any other office.
2. Reclassify `Office.type` from `college`/`service_office` to `college_office`/`university_office` (a rename, not a new concept).
3. Add three new scoped sub-admin roles — **VPAA** (college offices), **VPAF** (university offices), **OSAS** (students) — each reusing the existing `/admin/**` pages/APIs with server-side data scoping, and limited to Offices/Users/Complaints/Dashboard/Reports (not Categories/Routing Rules/SLA Rules/Settings/Audit Logs/Notifications, which stay administrator-only).
4. Add a Print button beside Download on generated reports, via an HTML print view.

Nothing here changes `administrator`'s existing unrestricted access (BR-010/096) — the new sub-admin roles are a *narrower* slice of what admin already does, not a replacement for it.

## 1. Roles & RBAC

**`src/lib/constants.ts`** — `USER_ROLES` changes from:
```ts
["student", "office_staff", "college_dean", "qa_office", "administrator"]
```
to:
```ts
["student", "office_staff", "qa_office", "administrator", "vpaa", "vpaf", "osas"]
```

**Migration**: a one-time script converts every existing `college_dean` user to `role: "office_staff"`, setting `officeRef` to their former `collegeRef` value (colleges are now valid `officeRef` targets — see Section 3). `collegeRef` is cleared on these migrated users (students remain the only role using `collegeRef`). No production data exists yet, so this is a one-off script run against the dev/seed DB, not a versioned migration framework.

**`src/middleware/rbac.ts`**:
- `/admin` and `/api/admin` prefixes match any of `["administrator", "vpaa", "vpaf", "osas"]`.
- `administrator` keeps its special-case bypass-everything behavior; the 3 new roles are confined to `/admin/**` only, same as today's admin gate — no bypass.
- Drop the `/dean` prefix mapping entirely.
- `homeRouteForRole`: add `vpaa`/`vpaf`/`osas` → `/admin/dashboard`; remove `college_dean` case.

**`rbac.test.ts`**: replace `college_dean` assertions with equivalent coverage for `vpaa`/`vpaf`/`osas` (can access `/admin/**`, cannot bypass non-admin prefixes, `administrator` still bypasses everything).

**`src/lib/auth.config.ts`**: no structural change — `role` typing widens automatically via `UserRole`.

**`src/features/admin/schemas/user.schema.ts`**: `superRefine` rules updated —
- `role === "student"` → requires `collegeRef`.
- `role === "office_staff" || role === "qa_office"` → requires `officeRef` (may now point to a `college_office`-type Office).
- `role === "vpaa" || role === "vpaf" || role === "osas" || role === "administrator"` → requires neither.
- Remove the `college_dean` branch and the "one active dean per college" uniqueness check in `POST /api/admin/users` / `PATCH /api/admin/users/[id]` (no longer applicable — no equivalent "one VPAA/VPAF/OSAS" constraint is being introduced).

**Account creation boundary**: only `administrator` can create/edit `administrator`/`vpaa`/`vpaf`/`osas` accounts. `vpaa`/`vpaf` can create/edit `office_staff`/`qa_office` users scoped to their office category; `osas` can create/edit `student` users. Enforced in the scoped Users route (Section 4), not by widening the schema's role-assignability further.

**Seed script** (`src/app/api/dev/seed/route.ts`): remove the dean seed account; add one seed account each for `vpaa`, `vpaf`, `osas`.

## 2. Dean removal — files touched

Deleted wholesale:
- `src/app/dean/**` (7 pages + loading states)
- `src/components/dean/DeanNav.tsx`, `src/components/dean/ReassignForm.tsx` — **but** `ReassignForm`'s functionality (reassign/escalate a complaint to any office/staff) is not lost: it's generalized into the scoped complaint-assignment UI available to `vpaa`/`vpaf` within `/admin/complaints/[id]` (Section 4), replacing the dean-only escalation path.

Edited to remove `college_dean` branches:
- `src/app/api/complaints/route.ts` (list filter switch)
- `src/app/api/complaints/[id]/route.ts` (GET/PATCH access check)
- `src/app/api/complaints/[id]/assign/route.ts` — the broad "escalate to any office" branch moves to the `vpaa`/`vpaf` scoped-admin assignment path instead of living here
- `src/app/api/complaints/[id]/notes/route.ts` (no dean-specific branch existed beyond the generic non-student check — no change needed beyond confirming it still excludes only `student`)
- `src/app/api/complaints/[id]/attachments/route.ts` and `.../download/route.ts`
- `src/app/api/analytics/trends/route.ts` — role allow-list `["college_dean","qa_office","administrator"]` becomes `["qa_office","administrator"]`; `vpaa`/`vpaf`/`osas` get their analytics through the scoped `/admin/dashboard` path instead (Section 4), not this endpoint
- `src/app/api/offices/[id]/staff/route.ts` — allow-list `["college_dean","administrator"]` becomes `["administrator"]` (staff-picker for reassignment now lives in the scoped admin complaint UI, gated by `requireScopedAdmin()`)
- `src/app/api/reports/export/route.ts` — remove the `college_dean` branch; `vpaa`/`vpaf`/`osas` get equivalent scoping via `getAdminScope()` (Section 4)
- `src/app/admin/users/page.tsx`, `src/components/admin/EditUserButton.tsx` — `ROLE_OFFICE_TYPE` map drops `college_dean`, gains entries for `vpaa`/`vpaf`/`osas` (both `null` — no office/college field shown for these)

## 3. Office reclassification

**`src/models/Office.ts`**: `OFFICE_TYPES` changes from `["college", "service_office"]` to `["college_office", "university_office"]`. UI label mapping: `college_office` → "College Office", `university_office` → "University Office". `parentOffice`, `headUserRef`, indexes, `refIntegrityPlugin` usage unchanged.

**Migration**: one-off script updates existing `Office` documents (`type: "college"` → `"college_office"`, `type: "service_office"` → `"university_office"`).

**Every `type === "service_office"` / `type === "college"` comparison** is updated to the new values: `ReportsPanel.tsx`, `ReassignForm`-successor UI, `office.schema.ts`, `office.integration.test.ts`, seed script's office creation.

**Staffing**: `office_staff.officeRef` may now reference a `college_office`-type Office exactly as it already can a `university_office`-type one. Colleges become fully symmetric with university offices for assignment/resolution — no special-casing remains anywhere in complaint routing/assignment code based on office type, except for the admin-scope filtering in Section 4.

`student.collegeRef` is unchanged — students still reference their college via the same field; only the staffing side of colleges changes.

## 4. Sub-admin scoping (VPAA / VPAF / OSAS)

**New file `src/lib/admin-scope.ts`**:
```ts
type AdminScope =
  | { kind: "all" }
  | { kind: "college_office" }
  | { kind: "university_office" }
  | { kind: "student" };

function getAdminScope(role: UserRole): AdminScope
```
`administrator` → `all`; `vpaa` → `college_office`; `vpaf` → `university_office`; `osas` → `student`. Also exports helpers to turn a scope into a Mongo filter for each resource (Offices by `type`, Users by `officeRef`'s office type or `role: "student"`, Complaints by `assignedOfficeRef`'s office type — falling back to the routed category's `defaultOfficeRef` type for unassigned complaints).

**New guard in `src/lib/api-guards.ts`**: `requireScopedAdmin()` — accepts `administrator`, `vpaa`, `vpaf`, `osas`; returns `{ session, scope }`. Replaces `requireAdmin()` only on the Offices, Users, and Complaints admin routes. Categories, Routing Rules, SLA Rules, Settings, Audit Logs, and Notifications-broadcast routes keep `requireAdmin()` unchanged — this alone 403s the 3 new roles out of those resources without needing an explicit denylist.

**Per-resource behavior**:
- **Offices** (`/admin/offices`, `api/admin/offices*`): `vpaa`/`vpaf` list/CRUD filtered to their office type. `osas` has no access — nav item hidden, route-level 403 if navigated directly.
- **Users** (`/admin/users`, `api/admin/users*`): `vpaa`/`vpaf` see/manage `office_staff`/`qa_office` users whose `officeRef` resolves to their office type. `osas` sees/manages `role: "student"` users. None of the three can create/edit `administrator`/`vpaa`/`vpaf`/`osas` accounts.
- **Complaints** (`/admin/complaints*`, `api/admin/complaints/[id]`): `vpaa`/`vpaf` scoped by `assignedOfficeRef`'s office type (or the routed category's `defaultOfficeRef` type when unassigned). `osas` sees all complaints (students are the only complainants) framed student-centrically. `vpaa`/`vpaf` get the same broad reassignment/escalation power within their office type that `college_dean` used to have for colleges — this is where `ReassignForm`'s generalized successor lives.
- **Dashboard/Reports/Analytics** (`/admin/dashboard`, `ReportsPanel`, `report-data.service.ts`): `getAdminScope()` feeds a `scopeMatch` into the existing analytics-service functions and report queries, replacing the admin dashboard's current unscoped `{isArchived:false}`. The admin-only config-health checklist and `getCollegeComparison()` stay administrator-only sections, conditionally rendered. OSAS's dashboard is framed by student attributes (program, year level, satisfaction) across both office types rather than by office.
- **`AdminNav.tsx`**: nav items rendered conditionally by role — Categories/SLA Rules/Routing/Settings/Audit Logs/Notifications hidden for all 3 sub-roles; Offices hidden for `osas`.

## 5. Print feature

- Reuses `report-data.service.ts`'s `queryReportData()` — same query/filters as the existing CSV/Excel/PDF export.
- New route renders an HTML print view: a minimal, print-styled (`@media print`) table of the report data, no app chrome.
- `ReportsPanel.tsx`: a **Print** button appears beside **Download** for `status === "ready"` reports, opening the print view in a new tab, which auto-triggers `window.print()`.
- Fully independent of Sections 1–4 — no shared code, can be implemented and tested in isolation, in any order relative to the rest.

## 6. Rollout order

1. **Foundational data model** (Sections 1–3): role enum, office reclassification, dean removal, migration scripts. Hard cutover — not incrementally shippable, since Users/Offices/Complaints all reference the changed enums together.
2. **Sub-admin scoping** (Section 4): new roles usable, `admin-scope.ts`, `requireScopedAdmin()`, per-resource filtering, nav conditionals.
3. **Print feature** (Section 5): independent, can be built in parallel with 1–2.

## Out of scope

- No changes to `administrator`'s existing permissions or the config-health dashboard checklist.
- No new "one VPAA/VPAF/OSAS per category" uniqueness constraint (unlike the old one-dean-per-college rule) — multiple accounts per role are allowed unless a future requirement says otherwise.
- Categories/Routing Rules/SLA Rules/Settings/Audit Logs/Notifications-broadcast remain entirely administrator-only; not touched or exposed to sub-admins in any form (not even read-only).
