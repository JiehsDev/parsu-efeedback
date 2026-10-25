# UI flow audit — 23 October 2026

> Historical record. The 25 October 2026 [controlled-forwarding architecture](controlled-forwarding.md) supersedes OSAS-only handling and global VPAA/VPAF oversight.

The current workflow has one complaint-handling office: OSAS. Office colleagues can read all office complaints, including resolved and archived records. Assignment controls processing permission. The OSAS head retains assignment, review, reopening, and archive supervision. VPAA and VPAF have read-only complaint oversight. Administrator configuration remains separate.

## Review criteria

- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): consistent terminology, visible results, recognition of available actions, and recovery from mistakes. Applied to queue filters, empty results, navigation, and confirmation messages.
- [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): move focus into a dialog, contain Tab navigation, support Escape, and return focus to the initiating control. The implementation uses [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), consistent with the existing Radix selects.
- [WCAG labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html), [info and relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html), and [name, role, value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html): identify fields and programmatically connect their labels, hints, and errors. Icon-only navigation must retain accessible names on small screens.
- [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): announce completion and errors without forcing focus away from the task. Applied to password recovery, profile updates, and shared notifications.
- Existing theme contrast tests remain part of verification. Status colors use semantic theme tokens rather than pale text intended for a different background.

These are review criteria, not a claim of WCAG certification or a substitute for usability sessions with students and employees using assistive technology.

## Role and flow coverage

| Role                | Flow to check                                                                                                | Expected result                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest               | Sign in; register; request reset; open reset link; update password; return to sign in                        | Clear labels and validation; no credentials in a default GET submission; reset completion announced; password visibility available by keyboard |
| Student             | Submit category, title, description and supporting file; find ticket; edit or withdraw before assignment     | Only active OSAS categories offered; ticket confirmation; edit/withdraw controls disappear after processing begins                             |
| Student             | Read status messages; answer information request; review resolution; rate or close without rating            | Messages persist in complaint views; internal notes stay hidden; resolved is distinct from closed                                              |
| Student             | Submit identified or anonymous feedback; view prior feedback                                                 | OSAS named as reviewer; feedback is distinguished from a tracked complaint; anonymity wording matches displayed identity                       |
| OSAS handler        | Read office queue; filter own work; read colleague complaints, completed records, and archives               | All means all office complaints; colleague records clearly read-only; filtered empty results offer recovery                                    |
| OSAS handler        | Add internal note; request information; resume work; resolve with summary and optional update                | Server checks assignment; status/message/summary are preserved; no self-pickup or office transfer                                              |
| OSAS handler        | Release assignment with reason; request OSAS head review; request archival                                   | Complaint stays within OSAS; supervisory requests have clear names and reasons                                                                 |
| OSAS head           | Assign staff; change handler with reason; handle personally; review overdue cases                            | A target handler is required; assignment history remains; no destination-office picker                                                         |
| OSAS head           | Approve/reject archive request; archive; restore; reopen resolved complaint                                  | Reasons are labeled; archived cases are read-only until restored; reopening retains history                                                    |
| VPAA / VPAF         | Dashboard; full complaint history; reports; notifications; profile                                           | Read-only oversight; no assignment, status, notes, archive, user-management, or configuration controls                                         |
| Administrator       | Users and activation; offices and head membership; categories; SLA rules; settings                           | Admin-only pages and APIs agree; operational staff picker targets OSAS; three-day defaults and holiday rules are explained                     |
| Administrator       | Announcements; feedback review; audit logs; archive administration; report export, print, download, deletion | Actions have clear outcomes and confirmations; filters have accessible names; historical records remain readable                               |
| All signed-in roles | Profile; notifications; sign out; theme and mode; keyboard navigation; small screen navigation               | Role-appropriate destinations, one active navigation item, accessible icon labels, visible focus, readable states                              |
| All signed-in roles | Return to visited pages; mutate data; switch accounts                                                        | Existing memory cache is private to the user; writes invalidate reads; authorization is checked on the server                                  |

The table is the review inventory. Browser scenarios exercise the main complaint lifecycle, release and head review, archive approval and restoration, role navigation, profile and appearance, announcements, user and category creation, report generation/download/print, and public account recovery. Office edits, account activation, head membership changes, SLA/calendar saves, archive rejection, feedback deletion, and report deletion are checked in source and navigation rather than executed as browser mutations. Cache behavior retains its separate regression coverage described in [device caching](device-caching.md).

## Changes from the audit

- Removed obsolete Assigned and Escalated choices from current queue/report filters. Stored historical events remain readable; they do not become new actions.
- Added Closed and Withdrawn to the staff queue and Pending Information to administrative complaint filters. Renamed the student's completed grouping to Past complaints so closed and withdrawn cases are not presented as resolved.
- Corrected first-run student instructions, submission help, and feedback copy to describe OSAS handling. Removed the public-page slogan and framework metadata placeholder.
- Added the staff Reports destination. Navigation chooses the most specific path and archive query, with `aria-current` on exactly one link. Compact navigation and account controls have accessible names; disclosure controls support Escape.
- Removed admin management forms from direct page access by non-administrators, matching their existing API restrictions.
- Shared modals and confirmations now have focus containment, cancellation, return focus, semantic names, and viewport-constrained scrolling. Confirmations initially focus Cancel.
- Connected shared form labels to native fields and Radix selects. Added labels to profile, report, information, note, archive, and reopening fields. Connected password recovery errors to the email field and announced recovery completion.
- Made password visibility buttons keyboard-accessible. Rating buttons expose their selected state without declaring an unimplemented radio interaction pattern.
- Replaced low-contrast success/warning text and badges with theme tokens. Restoring a complaint requests a restoration reason rather than an archive reason.
- Corrected the category-level SLA form's remaining 24-hour response fallback to 72 hours, matching the response and resolution defaults.
- Prevented unhydrated sign-in submission and specified POST. Report generation now recovers from network exceptions instead of leaving the action busy.

## Repeating the browser checks

Run `npm run test:ui-audit`. The runner starts a disposable MongoDB database, a process-local S3 fixture, and a separate Next.js server on port 3101. It refuses an occupied port. Reset seeding is sent only to that server with a newly generated secret. Emails and remote fetch calls are blocked. The configured application database is not used.

The suite uses real UI sign-in for student, OSAS head, two OSAS staff, administrator, VPAA, and VPAF. Supporting files and report bytes use the local storage fixture. Password-reset testing simulates receipt of the email link by inserting an isolated reset token, then submits the actual reset form. This does not verify delivery to a real mailbox or a real Cloudflare bucket.

Results, failed-step details, and mobile screenshots are written under `.local-backups/ui-audit-*`, excluded from Git. The runner stops only its own server process tree, removes temporary generated TypeScript paths, and releases its temporary database and storage fixture.

The older `tests/e2e` suite resets tickets and includes pre-centralization assumptions. Do not run it against the working demo database. This audit suite is separate and checks the current workflow.

## Verification record

- Passed: 46 targeted Vitest checks covering centralized permissions, navigation selection, and theme contrast.
- Passed: all six browser scenarios across isolated runs. The final rerun passed shared account/appearance flows, the full complaint lifecycle, withdrawal/release/head review/archive approval, and navigation across seven role profiles. Category creation, modal keyboard behavior, report formats/printing/downloads, registration, and password recovery passed in the earlier run.
- Passed: TypeScript (`tsc --noEmit --incremental false`) and ESLint with zero warnings for changed source, scripts, and tests. Mobile checks use a 375-pixel viewport and wait for dashboard data before checking layout and account controls.
- The coverage inventory above distinguishes browser mutations from source review. Passing these scenarios does not mean every branch or error condition was exercised in a browser.
- Real email delivery, deployed storage configuration, and live screen-reader testing are outside the isolated browser run. Historical records and audit events are preserved rather than rewritten to hide past actions.
