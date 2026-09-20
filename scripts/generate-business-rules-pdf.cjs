/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Generates docs/business-rules-complete.pdf: the complete, current business
 * rule set for ParSU e-Feedback in one structured document.
 *
 * Basis: docs/business-rules.md (BR-001..BR-101) reconciled against the
 * implementation (roles, scoped admin, information-request workflow, SLA
 * escalation). Where the original wording is superseded by code, the rule
 * text here states current behavior and the change is listed in Section 9.
 *
 * Run: node scripts/generate-business-rules-pdf.cjs
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const outputPath = path.join(__dirname, "..", "docs", "business-rules-complete.pdf");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margin: 48,
  bufferPages: true,
  info: {
    Title: "ParSU e-Feedback Complete Business Rules",
    Author: "ParSU e-Feedback",
    Subject: "Business rules BR-001 to BR-115, roles, lifecycle, escalation, and access scope",
  },
});
doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  heading: "#111827",
  sub: "#1f2937",
  body: "#374151",
  muted: "#6b7280",
  rule: "#d1d5db",
  header: "#e0e7ff",
  stripe: "#f8fafc",
  accent: "#1d4ed8",
};

const usable = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const ensureSpace = (h) => {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom - 12) doc.addPage();
};

function h1(text) {
  ensureSpace(90);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(colors.accent).text(text);
  doc
    .moveTo(doc.page.margins.left, doc.y + 3)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 3)
    .strokeColor(colors.accent)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);
}
function h2(text) {
  ensureSpace(60);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(colors.sub).text(text);
  doc.moveDown(0.3);
}
function p(text) {
  doc.font("Helvetica").fontSize(9.3).fillColor(colors.body).text(text, { lineGap: 2 });
  doc.moveDown(0.4);
}
function bullets(items) {
  doc.font("Helvetica").fontSize(9.3).fillColor(colors.body);
  for (const item of items) {
    ensureSpace(26);
    doc.text(`-  ${item}`, { indent: 8, hangingIndent: 12, lineGap: 1.5 });
  }
  doc.moveDown(0.4);
}

function table(headers, rows, widths, opts = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum > usable() + 0.5) {
    throw new Error(`Table widths ${sum} exceed usable width ${usable().toFixed(1)}: ${headers[0]}`);
  }
  const x = doc.page.margins.left;
  const pad = 4;
  const fs_ = opts.fontSize ?? 8.2;

  function drawRow(row, isHeader, stripe) {
    const font = isHeader ? "Helvetica-Bold" : "Helvetica";
    const size = isHeader ? 8.4 : fs_;
    doc.font(font).fontSize(size);
    const heights = row.map((cell, i) => {
      doc.font(font).fontSize(size);
      return doc.heightOfString(String(cell), { width: widths[i] - pad * 2, lineGap: 1 }) + pad * 2;
    });
    const rowH = Math.max(...heights, 18);
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 12) {
      doc.addPage();
      if (!isHeader) drawRow(headers, true, false);
    }
    const y = doc.y;
    if (isHeader) doc.rect(x, y, sum, rowH).fill(colors.header);
    else if (stripe) doc.rect(x, y, sum, rowH).fill(colors.stripe);
    let cx = x;
    for (let i = 0; i < row.length; i++) {
      doc.rect(cx, y, widths[i], rowH).strokeColor(colors.rule).lineWidth(0.5).stroke();
      const bold = isHeader || (opts.boldFirst && i === 0);
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(size)
        .fillColor(isHeader ? colors.heading : colors.body)
        .text(String(row[i]), cx + pad, y + pad, { width: widths[i] - pad * 2, lineGap: 1 });
      cx += widths[i];
    }
    doc.y = y + rowH;
  }

  drawRow(headers, true, false);
  rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
  doc.moveDown(0.7);
}

// Standard rule table: ID | Rule | Enforced in
const RW = [50, 340, 108];
const ruleTable = (rows) => table(["ID", "Rule", "Enforced in"], rows, RW, { boldFirst: true });

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------
doc.moveDown(6);
doc.font("Helvetica-Bold").fontSize(28).fillColor(colors.heading).text("ParSU e-Feedback", { align: "center" });
doc.moveDown(0.2);
doc.font("Helvetica-Bold").fontSize(20).fillColor(colors.accent).text("Complete Business Rules", { align: "center" });
doc.moveDown(0.6);
doc
  .font("Helvetica")
  .fontSize(11)
  .fillColor(colors.muted)
  .text("Student complaint and feedback management system", { align: "center" });
doc.moveDown(2);
table(
  ["Item", "Detail"],
  [
    ["Document", "Business Rules BR-001 to BR-115 (structured, current implementation)"],
    ["Generated", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
    ["Scope", "Users, offices, routing, SLA, complaint lifecycle, assignment and escalation, information requests, notes, ratings, feedback, notifications, audit, reports, analytics, security, data integrity"],
    ["Rule IDs", "BR-001 to BR-101 keep the original client numbering. BR-102 to BR-115 are additions that document behavior introduced after the original set. Rules changed by later design decisions are noted in Section 9."],
    ["Source of truth", "docs/business-rules.md reconciled against the current code base"],
  ],
  [110, 388],
  { boldFirst: true, fontSize: 9 },
);

doc.addPage();

// ---------------------------------------------------------------------------
// Contents
// ---------------------------------------------------------------------------
h1("Contents");
bullets([
  "1. Roles and organizational model",
  "2. User management and authentication (BR-001 to BR-013, BR-083 to BR-087, BR-109)",
  "3. Colleges and offices (BR-014 to BR-020, BR-102)",
  "4. Categories, routing and SLA (BR-021 to BR-034)",
  "5. Complaint submission and lifecycle (BR-035 to BR-046, BR-101)",
  "6. Assignment, reassignment and escalation (BR-047 to BR-052, BR-107, BR-108)",
  "7. Timeline, attachments, notes, information requests, ratings and feedback (BR-053 to BR-070, BR-104 to BR-106, BR-111)",
  "8. Notifications, audit, reports, analytics, security and data integrity (BR-071 to BR-082, BR-088 to BR-100, BR-112 to BR-115)",
  "9. Status lifecycle table, authority matrix, configurable thresholds and change notes",
]);

// ---------------------------------------------------------------------------
// 1. Roles
// ---------------------------------------------------------------------------
h1("1. Roles and Organizational Model");
p("The system has exactly six application roles. There is no separate dean, college dean, QA office or office head role: those responsibilities are expressed through office assignment and Office.headUserRef.");
table(
  ["Role", "Home area", "Data scope"],
  [
    ["student", "/student", "Own complaints, own feedback, own profile."],
    ["office_staff", "/staff", "Complaints whose assignedOfficeRef equals the staff member's office. Also used for office heads, deans and the QA office account."],
    ["administrator", "/admin (and every route)", "Unrestricted: all data, configuration, users, offices, audit logs."],
    ["vpaa", "/admin", "college_office data only (offices, staff users, complaints, analytics, reports)."],
    ["vpaf", "/admin", "university_office data only."],
    ["osas", "/admin", "Student domain: student accounts, standalone feedback, complaints in student-affairs scope, read access across complaints."],
  ],
  [95, 110, 293],
  { boldFirst: true },
);
h2("Organizational model");
bullets([
  "Colleges and university offices share one Office collection. type is college_office or university_office.",
  "An office head is the user referenced by Office.headUserRef. Head status is never inferred from role. A head must already belong to the office (officeRef equals the office) and be active, and must hold role office_staff, administrator, vpaa, vpaf or osas; students can never be heads.",
  "A student belongs to exactly one college (collegeRef). Staff belong to exactly one office (officeRef).",
  "OSAS and OVPAA are ordinary university/college offices identified by code (OSAS, OVPAA) and used as fixed escalation and reassignment anchors for the osas role.",
]);

// ---------------------------------------------------------------------------
// 2. Users & Auth
// ---------------------------------------------------------------------------
h1("2. User Management and Authentication");
ruleTable([
  ["BR-001", "Each account has exactly one role: student, office_staff, administrator, vpaa, vpaf or osas. (Original list with college_dean and qa_office is superseded; see Section 9.)", "constants.ts, User.ts"],
  ["BR-002", "A role may be assigned to many accounts.", "User.ts"],
  ["BR-003", "Every account has a unique email address (stored lowercase).", "User.ts unique index"],
  ["BR-004", "Passwords are stored as a bcrypt hash only. Plaintext is never persisted.", "password.ts, User.ts"],
  ["BR-005", "An account must be active (isActive true) to sign in.", "auth.service.ts"],
  ["BR-006", "Each student has a unique student number.", "User.ts (employeeOrStudentId)"],
  ["BR-007", "Each staff or employee account has a unique employee ID.", "User.ts (employeeOrStudentId)"],
  ["BR-008", "A student belongs to exactly one college.", "register.schema.ts, User.ts"],
  ["BR-009", "Office staff belong to exactly one office. An office may designate one head through Office.headUserRef.", "User.ts, Office.ts"],
  ["BR-010", "Administrator has unrestricted access to all functions and routes. It is a distinct permission set, not staff plus extras.", "rbac.ts, api-guards.ts"],
  ["BR-011", "Account provisioning: administrator may create any account; vpaa and vpaf may create only office_staff inside their own office category; osas may create only student accounts. Students self-register through the public /register page, which only ever creates role student and never accepts a role from the request.", "admin/users route, register route"],
  ["BR-012", "The last successful login time is recorded.", "auth.service.ts"],
  ["BR-013", "An account locks for a configurable duration after a configurable number of consecutive failed logins.", "auth.service.ts, env.ts"],
  ["BR-083", "Every protected page or action requires a valid authenticated session.", "middleware.ts"],
  ["BR-084", "Role-based access is enforced on every protected route, not only authentication.", "rbac.ts"],
  ["BR-085", "Unauthorized access is rejected: pages redirect (wrong role goes to that role's own dashboard, no session goes to /login); API routes return 401 or 403 JSON.", "middleware.ts, rbac.ts"],
  ["BR-086", "Passwords are never compared or stored in plaintext (same guarantee as BR-004 from the login side).", "password.service.ts"],
  ["BR-087", "Sessions expire after a configurable inactivity period.", "auth.config.ts"],
  ["BR-109", "Password policy: 8 to 72 characters, at least one letter and one number. Applies to registration, admin-created accounts and resets.", "register.schema.ts"],
]);

// ---------------------------------------------------------------------------
// 3. Colleges & Offices
// ---------------------------------------------------------------------------
h1("3. Colleges and Offices");
ruleTable([
  ["BR-014", "A college is an organizational unit (an Office of type college_office) that students and its head belong to.", "Office.ts"],
  ["BR-015", "Each student belongs to exactly one college (same relationship as BR-008).", "User.ts"],
  ["BR-016", "Office and college management: administrator manages all offices; vpaa may create and manage only college_office records; vpaf only university_office records; osas has no Offices access at all (read included).", "admin/offices route"],
  ["BR-017", "An office may be the target of one or more complaint categories through routing rules and category default office.", "Category.ts, RoutingRule.ts"],
  ["BR-018", "An office may have one or more staff members.", "User.ts"],
  ["BR-019", "Every office (including colleges) has a unique, uppercase office code.", "Office.ts unique index"],
  ["BR-020", "Inactive offices do not receive new complaint assignments.", "Office.ts, routing.service.ts"],
  ["BR-102", "Office head: each office may have one head (headUserRef). The head must be active, eligible by role, and already belong to that office. Appointing, replacing and removing a head are audit-logged (OFFICE_HEAD_ASSIGNED, OFFICE_HEAD_REPLACED, OFFICE_HEAD_REMOVED). Every seeded office has an active head and at least one staff login.", "office-head.service.ts"],
]);

// ---------------------------------------------------------------------------
// 4. Category / Routing / SLA
// ---------------------------------------------------------------------------
h1("4. Categories, Routing and SLA");
ruleTable([
  ["BR-021", "Every complaint belongs to exactly one category.", "Complaint.ts"],
  ["BR-022", "Each category has one fixed priority and one target office. They are set through that category's SLA rule and routing rule and mirrored read-only onto the category (defaultPriority, defaultOfficeRef).", "Category.ts"],
  ["BR-023", "A category has at most one active routing rule (partial unique index).", "RoutingRule.ts"],
  ["BR-024", "An inactive category cannot be chosen when submitting a complaint.", "complaints route"],
  ["BR-025", "A routing rule maps one category to one target office.", "RoutingRule.ts"],
  ["BR-026", "Submitted complaints are routed automatically to the office defined by category (optionally college and priority conditions). No manual triage. If no valid route exists, submission fails with HTTP 422.", "routing.service.ts"],
  ["BR-027", "Only administrators create, update or deactivate routing rules.", "requireAdmin"],
  ["BR-028", "A routing rule may not target an inactive office.", "routing.service.ts"],
  ["BR-029", "A category has at most one active SLA rule. At most one institution-wide default (no category) may be active per priority as fallback. Submission fails with HTTP 422 (NO_SLA_RULE) if no rule resolves.", "SLARule.ts, sla.service.ts"],
  ["BR-030", "An SLA rule defines a first-response deadline (responseHours).", "SLARule.ts"],
  ["BR-031", "An SLA rule defines a separate resolution deadline (resolutionHours).", "SLARule.ts"],
  ["BR-032", "A complaint is flagged overdue (isOverdue) once a deadline is breached.", "sla-check route"],
  ["BR-033", "Automatic SLA escalation: a scheduled check warns once per clock when elapsed time reaches the warning threshold (default 80%). On breach it sets isOverdue, moves status to escalated and reassigns the complaint: to the SLA rule's escalateToOfficeRef when configured (staff assignment cleared), otherwise to the current office's head (Office.headUserRef). The first-response clock is only checked while no staff member holds the complaint. Each complaint is escalated at most once by the automatic check.", "sla-check route"],
  ["BR-034", "Only administrators create, update or deactivate SLA rules.", "requireAdmin"],
]);

// ---------------------------------------------------------------------------
// 5. Lifecycle
// ---------------------------------------------------------------------------
h1("5. Complaint Submission and Lifecycle");
ruleTable([
  ["BR-035", "Only students may submit complaints.", "complaints route"],
  ["BR-036", "Each complaint receives a unique, immutable, human-readable ticket number, format PREFIX-YYYY-NNNNNN (for example PARSU-2026-000001), generated with an atomic counter.", "ticket-number.service.ts"],
  ["BR-037", "A complaint requires category, title (5 to 200 characters) and description (at least 20 characters). Priority is not chosen by the student; it is inherited from the category.", "complaint.schema.ts"],
  ["BR-038", "Every complaint is linked to exactly one submitting student.", "Complaint.ts"],
  ["BR-039", "A student can retrieve their own complaints.", "complaints route"],
  ["BR-040", "A complaint has exactly one current status. A transition to the same status is rejected.", "status-transitions.service.ts"],
  ["BR-041", "Status follows the lifecycle in Section 9 (submitted, assigned, in_progress, pending_information, escalated, resolved, closed, withdrawn). Invalid transitions return HTTP 400.", "status-transitions.service.ts"],
  ["BR-042", "A closed complaint cannot be edited by the student; its only valid transition is reopening.", "status-transitions.service.ts"],
  ["BR-043", "Resolved or closed complaints may be reopened (to in_progress) by authorized personnel.", "complaints/[id] route"],
  ["BR-044", "reopenCount increments when a closed complaint is reopened. (Reopening from resolved is allowed but is not currently counted; see Section 9.)", "complaints/[id] route"],
  ["BR-045", "Complaints are never deleted. Only administrators may archive or unarchive a complaint (isArchived), hiding it from active views without removing history.", "admin/complaints/[id]"],
  ["BR-046", "Each complaint records five distinct timestamps: submitted, resolved, closed, created, updated.", "Complaint.ts"],
  ["BR-101", "While status is submitted, the owning student may edit title and description or withdraw the complaint. Priority cannot be edited. Once staff picks it up, neither is possible. Withdrawn is terminal and soft (record kept). A withdrawn complaint cannot be assigned or revived by anyone.", "complaints/[id], assign routes"],
  ["BR-103", "Status changes (other than the information-request workflow) are made only by office_staff of the complaint's office and administrator. vpaa, vpaf and osas cannot change status; their write power is limited to reassignment and escalation.", "complaints/[id] PATCH"],
]);

// ---------------------------------------------------------------------------
// 6. Assignment & Escalation
// ---------------------------------------------------------------------------
h1("6. Assignment, Reassignment and Escalation");
ruleTable([
  ["BR-047", "A complaint may have many assignment records over its lifetime. Complaint.assignedOfficeRef and assignedStaffRef are only current-state pointers.", "Assignment.ts"],
  ["BR-048", "Assignment authority: office_staff (own office only), vpaa (college offices), vpaf (university offices), osas (student-affairs scope) and administrator. Students and unlisted roles are refused (fail closed).", "assign route"],
  ["BR-049", "Each assignment record captures who assigned, who it was assigned to, source office, destination office, reason, action type and time.", "Assignment.ts"],
  ["BR-050", "The initial assignment from automatic routing is a system action (assignedByRef null).", "complaints route"],
  ["BR-051", "Reassignment creates a new assignment record. Previous records are never modified.", "assign route"],
  ["BR-052", "Assignment records are append-only.", "Assignment.ts"],
  ["BR-107", "Assignment scope rules. Office staff: only complaints in their own office, only to staff of the same office, never to another office. VPAA and VPAF: only complaints currently in their office category, only to active offices of that category, staff must belong to the target office. OSAS: only complaints in student-affairs scope and only to allowed destinations (OSAS, OVPAA, the complaint's office, category default, routing target, SLA escalation target, or active college offices). Administrator: any active office and any office_staff. The first assignment out of submitted moves status to assigned.", "assign route, osas-complaint-scope.ts"],
  ["BR-108", "Manual escalation: an assign request with action escalate sets status to escalated and records the assignment with action type manual_escalation, a timeline event (escalated) and an audit entry. An OSAS escalation must go to the configured destination: the category SLA rule's escalateToOfficeRef when set, otherwise OVPAA. Automatic escalations record action type sla_escalation and reason SLA_BREACH. Both keep full history.", "assign route, sla-check route"],
]);

// ---------------------------------------------------------------------------
// 7. Timeline, attachments, notes, info requests, ratings, feedback
// ---------------------------------------------------------------------------
h1("7. Timeline, Attachments, Notes, Information Requests, Ratings and Feedback");
h2("7.1 Timeline");
ruleTable([
  ["BR-053", "A timeline entry is created for every significant action: submission, assignment, reassignment, status change, note, attachment, escalation, resolution, reopening, closure, rating, edit, withdrawal, information request and information submission.", "ComplaintTimeline.ts"],
  ["BR-054", "Each entry records the event type.", "ComplaintTimeline.ts"],
  ["BR-055", "Each entry records the actor, or null for a system event.", "ComplaintTimeline.ts"],
  ["BR-056", "Event type is restricted to a fixed set (submitted, assigned, reassigned, status_changed, note_added, attachment_added, escalated, resolved, reopened, closed, rated, edited, withdrawn, information_requested, information_submitted).", "constants.ts"],
  ["BR-057", "Timeline entries are immutable.", "ComplaintTimeline.ts"],
]);
h2("7.2 Attachments");
ruleTable([
  ["BR-058", "A complaint may have multiple attachments.", "Attachment.ts"],
  ["BR-059", "Attachments store metadata only (URL, name, MIME type, size). Files live in Cloudflare R2 through presigned uploads.", "presign route"],
  ["BR-060", "Only allowed MIME types may be uploaded (configurable).", "presign route, env.ts"],
  ["BR-061", "Uploads may not exceed a configurable maximum size (default 10 MB).", "presign route, env.ts"],
  ["BR-062", "Deleting an attachment never deletes its complaint.", "Attachment.ts"],
]);
h2("7.3 Internal notes");
ruleTable([
  ["BR-063", "Internal notes are staff-facing only and never shown to the submitting student.", "notes route"],
  ["BR-064", "Student views never expose notes or the flag that reveals them.", "complaint-access.ts"],
  ["BR-065", "Each note belongs to exactly one complaint.", "ComplaintNote.ts"],
  ["BR-066", "Notes cannot be edited or deleted.", "notes route (no update route)"],
  ["BR-111", "Who may read and write notes: office_staff of the complaint's office, administrator, and vpaa, vpaf or osas within their scope. Students are always refused.", "complaint-access.ts"],
]);
h2("7.4 Information requests (pending_information workflow)");
ruleTable([
  ["BR-104", "Staff may request additional information only from a complaint in in_progress. The complaint moves to pending_information and the student is notified. Only one open request may exist per complaint (HTTP 409 otherwise). Message is required (1 to 2000 characters), context optional.", "information-request route"],
  ["BR-105", "Who may request: the office_staff member currently assigned to the complaint (in that office), administrator, osas for complaints in student-affairs scope, vpaa and vpaf within their category. pending_information cannot be set or left through the generic status endpoint.", "information-request route, complaints/[id]"],
  ["BR-106", "Only the owning student may respond, and only while the complaint is pending_information with an open request. The response (1 to 4000 characters, up to 10 attachments belonging to that complaint and student) marks the request responded, returns the complaint to in_progress, logs two timeline events and audit entries, and notifies the assigned staff and the office head (or all active office staff if neither exists). Requests and responses are retained as history.", "information-response route"],
]);
h2("7.5 Ratings and standalone feedback");
ruleTable([
  ["BR-067", "A student may submit exactly one 1 to 5 satisfaction rating per complaint.", "rate route"],
  ["BR-068", "Only the submitting student may rate their complaint.", "rate route"],
  ["BR-069", "A rating is accepted only when the complaint is resolved.", "rate route"],
  ["BR-070", "Rating value and optional comment are stored together.", "Complaint.ts"],
  ["BR-110", "Standalone feedback (separate from a complaint rating) is created, edited and archived only by the owning student; archiving is soft. Feedback has no office or college link, so administrator and osas alone may view it; vpaa and vpaf have no feedback access.", "feedback routes, admin-scope.ts"],
]);

// ---------------------------------------------------------------------------
// 8. Notifications, audit, reports, analytics, security, integrity
// ---------------------------------------------------------------------------
h1("8. Notifications, Audit, Reports, Analytics, Security and Data Integrity");
h2("8.1 Notifications");
ruleTable([
  ["BR-071", "Notifications are generated for defined events: complaint submitted, complaint assigned, status updated, complaint resolved, SLA warning, escalation, report generated, system announcement.", "notification.service.ts"],
  ["BR-072", "A user may accumulate many notifications.", "Notification.ts"],
  ["BR-073", "Notifications default to unread and can be marked read by their recipient.", "notifications/[id]/read"],
  ["BR-074", "Notification type is restricted to a fixed set.", "constants.ts"],
  ["BR-112", "Information requests and submissions also notify the relevant party (student on request, staff and head on response). System announcements are broadcast by administrators only.", "notification.service.ts, email.service.ts"],
]);
h2("8.2 Audit log");
ruleTable([
  ["BR-075", "Audit entries are written for administrative, staff and system actions. System-generated actions (for example SLA escalation) record actorRef null.", "audit-log.service.ts"],
  ["BR-076", "Each entry records actor, action, entity type and ID, before and after state, IP, user agent and timestamp.", "AuditLog.ts"],
  ["BR-077", "Audit entries are insert-only. Only administrators may view audit logs.", "AuditLog.ts, requireAdmin"],
]);
h2("8.3 Reports and analytics");
ruleTable([
  ["BR-078", "A generated report belongs to exactly one creating user.", "GeneratedReport.ts"],
  ["BR-079", "Reports may be generated as PDF, Excel or CSV.", "reports/export route"],
  ["BR-080", "Reports may be filtered by office, college, category, date range, status and SLA compliance.", "report-data.service.ts"],
  ["BR-081", "The filters used are stored with the report record.", "GeneratedReport.ts"],
  ["BR-082", "A generation timestamp is recorded for every report.", "GeneratedReport.ts"],
  ["BR-113", "Report scope: students cannot generate reports; office_staff reports are forced to their own office; vpaa and vpaf are constrained to offices of their category; administrator and osas are unconstrained by office.", "reports/export route"],
  ["BR-088", "The system generates aggregate analytics on complaint volume, resolution time and SLA compliance.", "analytics.service.ts"],
  ["BR-089", "KPIs include open and overdue counts, average resolution time, SLA compliance %, category and priority distribution, monthly trend and average satisfaction, scoped by role (office, office category or institution).", "analytics.service.ts"],
  ["BR-090", "Analytics reflect live data at query time.", "analytics.service.ts"],
]);
h2("8.4 Security and access scope");
ruleTable([
  ["BR-091", "Each role sees only the complaint data it is authorized for, enforced at the route level and again inside every handler.", "rbac.ts, complaint-access.ts"],
  ["BR-092", "A student may access only complaints they submitted.", "complaint-access.ts"],
  ["BR-093", "Office staff may access only complaints assigned to their own office.", "complaint-access.ts"],
  ["BR-094", "VPAA and VPAF read all complaints currently assigned to offices of their category. Deans are represented by college office heads (office_staff), not by a separate role. (Replaces the original college-dean oversight rule.)", "admin-scope.ts"],
  ["BR-095", "OSAS reads every complaint in full (detail, notes, attachments) but cannot change status. There is no QA role; the QA office account is an office_staff user with ordinary office scope. (Replaces the original institution-wide QA read rule.)", "admin-scope.ts"],
  ["BR-096", "Administrator has unrestricted access to all complaint data, routes and admin functions.", "rbac.ts"],
  ["BR-097", "Every action is authorized inside its handler, not only by middleware, since middleware cannot know that staff A must not act on office B's complaint.", "all API routes"],
  ["BR-098", "Data in transit uses HTTPS; secrets such as passwords and reset tokens are stored hashed.", "password.ts, PasswordResetToken.ts"],
  ["BR-114", "Administrator-only functions: categories, routing rules, SLA rules, settings, audit logs, announcements broadcast, complaint archiving. vpaa, vpaf and osas receive 403 for these; they share only the Offices, Users and Complaints admin routes, filtered to their scope.", "requireAdmin, requireScopedAdmin"],
  ["BR-115", "Scoped users list: vpaa and vpaf see staff of their office category, osas sees students, administrator sees everyone.", "admin-scope.ts"],
]);
h2("8.5 Data integrity");
ruleTable([
  ["BR-099", "Every reference between records must point to an existing record (reference-integrity plugin on all models).", "mongoose-ref-integrity.ts"],
  ["BR-100", "Unique identifiers (ticket numbers, office codes, emails, student and employee IDs) are immutable once assigned and never reused. Ticket numbers use an atomic counter so concurrent submissions cannot collide.", "Counter.ts, ticket-number.service.ts"],
]);

// ---------------------------------------------------------------------------
// 9. Lifecycle table, authority matrix, thresholds, change notes
// ---------------------------------------------------------------------------
h1("9. Status Lifecycle, Authority Matrix, Thresholds and Change Notes");
h2("9.1 Allowed status transitions");
table(
  ["From", "Allowed next status", "Notes"],
  [
    ["submitted", "assigned, withdrawn", "withdrawn only by the owning student (BR-101)"],
    ["assigned", "in_progress, escalated", ""],
    ["in_progress", "pending_information, escalated, resolved", "pending_information only via information request (BR-104)"],
    ["pending_information", "in_progress", "only when the student responds (BR-106)"],
    ["escalated", "in_progress, assigned", "higher authority starts work or reassigns"],
    ["resolved", "closed, in_progress", "in_progress is a reopen; rating allowed while resolved"],
    ["closed", "in_progress", "reopen; increments reopenCount"],
    ["withdrawn", "none", "terminal"],
  ],
  [105, 200, 193],
  { boldFirst: true },
);

h2("9.2 Authority matrix");
p("Y = allowed, S = allowed within scope, R = read only, - = not allowed.");
table(
  ["Action", "Student", "Staff", "VPAA", "VPAF", "OSAS", "Admin"],
  [
    ["Submit complaint / feedback", "Y", "-", "-", "-", "-", "-"],
    ["Edit or withdraw (submitted only)", "Y", "-", "-", "-", "-", "-"],
    ["View complaint", "own", "S office", "S college", "S university", "R all", "Y"],
    ["Change status", "-", "S office", "-", "-", "-", "Y"],
    ["Assign / reassign", "-", "S office", "S college", "S university", "S student affairs", "Y"],
    ["Manual escalate", "-", "S office", "S college", "S university", "S to VPAA", "Y"],
    ["Request information", "-", "S assigned", "S college", "S university", "S scope", "Y"],
    ["Respond to information request", "own", "-", "-", "-", "-", "-"],
    ["Internal notes", "-", "S office", "S college", "S university", "S all", "Y"],
    ["Rate resolved complaint", "own", "-", "-", "-", "-", "-"],
    ["Generate reports", "-", "S office", "S college", "S university", "Y", "Y"],
    ["Manage users", "-", "-", "S staff, college", "S staff, university", "S students", "Y"],
    ["Manage offices / heads", "-", "-", "S college", "S university", "-", "Y"],
    ["View standalone feedback", "own", "-", "-", "-", "Y", "Y"],
    ["Categories, routing, SLA, settings, audit, broadcast, archive", "-", "-", "-", "-", "-", "Y"],
  ],
  [150, 45, 55, 58, 62, 68, 60],
  { boldFirst: true, fontSize: 7.6 },
);

h2("9.3 Configurable thresholds");
table(
  ["Rule", "Setting", "Default"],
  [
    ["BR-013", "AUTH_MAX_FAILED_LOGIN_ATTEMPTS, AUTH_LOCKOUT_DURATION_MINUTES", "5 attempts, 15 minutes"],
    ["BR-087", "AUTH_SESSION_MAX_AGE_MINUTES", "60 minutes"],
    ["BR-060", "UPLOAD_ALLOWED_MIME_TYPES", "see .env.example"],
    ["BR-061", "UPLOAD_MAX_FILE_SIZE_MB", "10 MB"],
    ["BR-036", "TICKET_NUMBER_PREFIX", "PARSU"],
    ["BR-033", "SLA warning threshold percent (per SLA rule); suggested hours by priority: critical 4/24, high 8/48, medium 24/120, low 48/168 (response/resolution)", "80%"],
  ],
  [70, 340, 88],
  { boldFirst: true },
);

h2("9.4 Change notes versus the original BR-001 to BR-101 document");
bullets([
  "BR-001, 009, 011: roles college_dean and qa_office no longer exist. vpaa, vpaf and osas were added as scoped sub-admin roles. Deans and the QA office are office_staff users; an office's head is recorded in Office.headUserRef.",
  "BR-016: office management extends to vpaa and vpaf within their own office category (osas has none).",
  "BR-033: escalation defaults to the office head; an SLA rule's escalateToOfficeRef overrides it. Cross-office escalation clears the previous staff assignment.",
  "BR-044: reopenCount only increments when reopening from closed. Reopening from resolved is permitted but not counted; this is a known gap to fix if resolved-to-in_progress reopens must be counted.",
  "BR-048, 093 to 095: assignment and access scopes rewritten for the current roles (college oversight moved from college_dean to vpaa; institution-wide QA read replaced by osas read access).",
  "New rules BR-102 to BR-115 document the office head, scoped administration, information-request workflow, escalation scope, feedback access, notification and report scope, and the password policy as actually implemented.",
  "Manual escalation currently uses the assign endpoint with action escalate and stays within the actor's authority scope. A dedicated workflow that automatically routes staff escalations to the office head and office heads to a configured higher authority is not part of the current rule set.",
]);

// ---------------------------------------------------------------------------
// Header/footer
// ---------------------------------------------------------------------------
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  if (i === 0) continue;
  doc.font("Helvetica").fontSize(8).fillColor(colors.muted);
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.text("ParSU e-Feedback | Complete Business Rules", doc.page.margins.left, 26, { width: w, align: "left", lineBreak: false });
  doc.text(`Page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 30, { width: w, align: "center", lineBreak: false });
}

doc.end();
console.log(outputPath);
