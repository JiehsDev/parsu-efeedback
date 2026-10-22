# Dashboard demo data

Run `npm run seed:demo` from the project root with the development database configured in `.env.local`. The script refuses production mode. This is an **additive** seed: it preserves existing complaints, configuration, passwords, and any edits made to demo complaints. Rerunning it creates only missing fixtures. It does not send email or create external storage objects.

The normal development reset seed remains separate and clears tickets. Do not run that reset when you want to keep your demo work.

With the standard 40 categories, the demo seed adds **100 complaints**: 20 workflow examples and 80 recent/historical cases across all categories, four priorities, and approximately six months. These populate charts, SLA compliance, response/resolution averages, satisfaction, filters, and report exports. Every complaint belongs to OSAS. Staff examples are assigned only to active OSAS personnel.

## Accounts

New demo accounts use password `ParSU_test2026`. Existing account passwords are preserved.

| Account | Purpose |
| --- | --- |
| `osasdirector@parsu.edu.ph` | Existing OSAS head: assignment, personal handling, supervisor and archive reviews. Use its existing password. |
| `osas.demo.staff@parsu.edu.ph` | First demo handler; can see their own assigned complaints. |
| `osas.demo.staff2@parsu.edu.ph` | Second demo handler; verify a different assignment queue. |
| `demo.student@parsu.edu.ph` | Owns all 20 workflow examples plus historical cases; submit information, rate, close, or withdraw eligible complaints. |
| `demo.student2@parsu.edu.ph` through `demo.student6@parsu.edu.ph` | Separate students across configured colleges with their own historical complaints. |

Existing administrator, VPAA, and VPAF accounts can use their dashboards and reporting permissions to inspect the added data. The seed does not change their access or passwords.

## Workflow examples

Search by ticket number in the complaint list. All numbers start with `DEMO-OSAS-`; titles start with `[Demo]`.

| Suffix | Starting scenario / action to try |
| --- | --- |
| `0001` | New complaint: head assigns a staff member or handles personally. |
| `0002` | Unassigned, response SLA nearing its deadline. |
| `0003` | Unassigned and overdue. |
| `0004` | Assigned to second demo handler; public status message and private internal note. |
| `0005` | Assigned to second demo handler; compare visibility between staff accounts. |
| `0006` | Head handling personally. |
| `0007` | Pending information: sign in as primary demo student and respond. |
| `0008` | Student already responded; handler continues processing. |
| `0009` | Assigned and resolution due soon. |
| `0010` | Overdue with internal OSAS supervisor review required. |
| `0011` | Resolved: primary student can rate or close without rating. |
| `0012` | Closed with a five-star rating. |
| `0013` | Closed without rating. |
| `0014` | Withdrawn before assignment. |
| `0015` | Pending archive request: head approves or rejects. |
| `0016` | Archived: open archived complaints and restore. |
| `0017` | Reopened, preserving earlier resolution in timeline. |
| `0018` | Released by handler and awaiting head reassignment. |
| `0019` | Archive request rejected with a review reason. |
| `0020` | Resolved: head can reopen with a reason. |

Both SLA clocks use 72 eligible hours, excluding weekends and configured holidays in Philippine time. Due-soon examples are computed relative to the seed's execution time; weekends and holidays move deadlines to an eligible day. As time passes, examples naturally become overdue. Rerunning does not reset clocks or undo actions you tried.

Use a real local file when trying attachment upload/download; the seed does not create placeholder attachments or fake report downloads. Export reports through the normal report action to exercise generation and download.

## Verification

`npx vitest run src/features/seed/demo-seed.integration.test.ts --maxWorkers=1` verifies schema validity, workflow coverage, account references, both SLA clocks, data preservation, idempotence, and recovery after an interrupted fixture insert using an isolated database.
