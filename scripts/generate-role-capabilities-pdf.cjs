/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const outputPath = path.join(__dirname, "..", "docs", "role-capabilities-and-accounts.pdf");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margin: 48,
  bufferPages: true,
  info: {
    Title: "ParSU e-Feedback Role Capabilities and Seed Accounts",
    Author: "ParSU e-Feedback",
    Subject: "RBAC capabilities and seeded login accounts",
  },
});

doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  heading: "#111827",
  subheading: "#1f2937",
  body: "#374151",
  muted: "#6b7280",
  rule: "#d1d5db",
  accent: "#2563eb",
};

function title(text) {
  doc.font("Helvetica-Bold").fontSize(20).fillColor(colors.heading).text(text, {
    align: "center",
  });
  doc.moveDown(0.35);
}

function subtitle(text) {
  doc.font("Helvetica").fontSize(9.5).fillColor(colors.muted).text(text, {
    align: "center",
  });
  doc.moveDown(1.1);
}

function h1(text) {
  ensureSpace(78);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(colors.heading).text(text);
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(colors.rule)
    .lineWidth(0.7)
    .stroke();
  doc.moveDown(0.8);
}

function h2(text) {
  ensureSpace(54);
  doc.moveDown(0.35);
  doc.font("Helvetica-Bold").fontSize(11.5).fillColor(colors.subheading).text(text);
  doc.moveDown(0.2);
}

function p(text) {
  doc.font("Helvetica").fontSize(9.5).fillColor(colors.body).text(text, {
    lineGap: 2,
  });
  doc.moveDown(0.35);
}

function bullets(items) {
  doc.font("Helvetica").fontSize(9.2).fillColor(colors.body);
  for (const item of items) {
    ensureSpace(28);
    doc.text(`- ${item}`, {
      indent: 10,
      hangingIndent: 10,
      lineGap: 1.4,
    });
  }
  doc.moveDown(0.35);
}

function ensureSpace(height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function table(headers, rows, widths) {
  const x = doc.page.margins.left;
  const rowPadding = 5;

  function drawRow(row, isHeader = false) {
    const startY = doc.y;
    const heights = row.map((cell, index) => {
      const textHeight = doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isHeader ? 8.8 : 8.5)
        .heightOfString(String(cell), { width: widths[index] - rowPadding * 2 });
      return textHeight + rowPadding * 2;
    });
    const rowHeight = Math.max(...heights, 22);
    ensureSpace(rowHeight + 4);

    let cursorX = x;
    if (isHeader) {
      doc.rect(x, doc.y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill("#eef2ff");
    }
    for (let i = 0; i < row.length; i++) {
      doc
        .rect(cursorX, doc.y, widths[i], rowHeight)
        .strokeColor(colors.rule)
        .lineWidth(0.5)
        .stroke();
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isHeader ? 8.8 : 8.5)
        .fillColor(isHeader ? colors.heading : colors.body)
        .text(String(row[i]), cursorX + rowPadding, startY + rowPadding, {
          width: widths[i] - rowPadding * 2,
          lineGap: 1,
        });
      cursorX += widths[i];
    }
    doc.y = startY + rowHeight;
  }

  drawRow(headers, true);
  for (const row of rows) drawRow(row);
  doc.moveDown(0.75);
}

const roleRows = [
  [
    "Student",
    "student",
    "Own student area only",
    "Can submit complaints and feedback; can only see and change their own records.",
  ],
  [
    "Office Staff",
    "office_staff",
    "Assigned office",
    "Can work complaints routed to their office and generate office-scoped reports.",
  ],
  [
    "Administrator",
    "administrator",
    "All data and routes",
    "Unrestricted system administrator with configuration, account, reporting, and audit access.",
  ],
  [
    "VPAA",
    "vpaa",
    "College offices",
    "Scoped sub-admin for college-office complaints, offices, staff users, analytics, and reports.",
  ],
  [
    "VPAF",
    "vpaf",
    "University offices",
    "Scoped sub-admin for university-office complaints, offices, staff users, analytics, and reports.",
  ],
  [
    "OSAS",
    "osas",
    "Student domain",
    "Scoped sub-admin for student users, all complaint detail read access, student feedback, reports, and OSAS reassignment/escalation.",
  ],
];

const accountRows = [
  ["student@parsu.edu.ph", "student", "Active", "Elliot Anderson", "College of Engineering & Computational Sciences"],
  ["inactive@parsu.edu.ph", "student", "Inactive", "Inactive Test", "Login rejection test account"],
  ["student20001@parsu.edu.ph through student20035@parsu.edu.ph", "student", "Active", "Generated names", "7 generated students per seeded college"],
  ["staff@parsu.edu.ph", "office_staff", "Active", "Maria Santos", "Office of the University Registrar (head)"],
  ["staff2@parsu.edu.ph", "office_staff", "Active", "Pedro Penduko", "Office of Student Affairs and Services"],
  ["staff3@parsu.edu.ph", "office_staff", "Active", "Pedro Penduko", "Office of the University Registrar"],
  ["staff4@parsu.edu.ph", "office_staff", "Active", "Liza Domingo", "General Services Office (head)"],
  ["staff5@parsu.edu.ph", "office_staff", "Active", "Noel Aguilar", "College of Engineering & Computational Sciences (head)"],
  ["staff8@parsu.edu.ph", "office_staff", "Active", "Grace Manalo", "College of Engineering & Computational Sciences"],
  ["dean.ced@parsu.edu.ph", "office_staff", "Active", "Andrea Castillo", "College of Education (head)"],
  ["staff9@parsu.edu.ph", "office_staff", "Active", "Roberto Tolentino", "College of Education"],
  ["dean.cbm@parsu.edu.ph", "office_staff", "Active", "Christian Mendoza", "College of Business & Management (head)"],
  ["staff10@parsu.edu.ph", "office_staff", "Active", "Michelle Diaz", "College of Business & Management"],
  ["dean.cos@parsu.edu.ph", "office_staff", "Active", "Rosa Navarro", "College of Science (head)"],
  ["staff11@parsu.edu.ph", "office_staff", "Active", "Daniel Espinosa", "College of Science"],
  ["dean.cah@parsu.edu.ph", "office_staff", "Active", "Katrina Ocampo", "College of Arts and Humanities (head)"],
  ["staff12@parsu.edu.ph", "office_staff", "Active", "Julia Lopez", "College of Arts and Humanities"],
  ["staff6@parsu.edu.ph", "office_staff", "Active", "Carlos Mercado", "Office of the Vice President for Academic Affairs (head)"],
  ["staff13@parsu.edu.ph", "office_staff", "Active", "Marco Pascual", "Office of the Vice President for Academic Affairs"],
  ["staff7@parsu.edu.ph", "office_staff", "Active", "Bea Salonga", "Office of the Vice President for Administration and Finance (head)"],
  ["staff14@parsu.edu.ph", "office_staff", "Active", "Bianca Del Rosario", "Office of the Vice President for Administration and Finance"],
  ["staff16@parsu.edu.ph", "office_staff", "Active", "Nathaniel Rivera", "General Services Office"],
  ["staff17@parsu.edu.ph", "office_staff", "Active", "Samantha Aguilar", "Office of the University Registrar"],
  ["qa@parsu.edu.ph", "office_staff", "Active", "Elena Reyes", "Quality Assurance Office (head); follows office_staff permissions"],
  ["staff15@parsu.edu.ph", "office_staff", "Active", "Paolo Salazar", "Quality Assurance Office"],
  ["admin@parsu.edu.ph", "administrator", "Active", "System Administrator", "No office or college scope"],
  ["vpaa@parsu.edu.ph", "vpaa", "Active", "Dr. Juan Cruz", "College-office sub-admin"],
  ["vpaf@parsu.edu.ph", "vpaf", "Active", "Rosario Villanueva", "University-office sub-admin"],
  ["osas@parsu.edu.ph", "osas", "Active", "Cristina Bautista", "Student-domain sub-admin; Office.headUserRef for OSAS"],
];

title("ParSU e-Feedback");
subtitle(`Role Capabilities and Seed Accounts | Generated ${new Date().toLocaleDateString("en-US")}`);

h1("Login Notes");
bullets([
  "All seeded test accounts use the password ParSU_test2026.",
  "The seed route creates 63 users: 28 named base users plus 35 generated active students.",
  "QA is not a separate application role in the current implementation; qa@parsu.edu.ph is an office_staff account assigned to the Quality Assurance Office.",
  "Administrator is unrestricted. VPAA, VPAF, and OSAS use the admin area but are data-scoped by backend guards.",
  "Office Head authority is Office.headUserRef, not a separate software role: every seeded college and university office now has one distinct head account plus at least one ordinary (non-head) office_staff account, so head-only actions (Assign Staff, Change Assignee, Reassign Office) can be tested against a real non-head staff member in every office. The Registrar has two ordinary staff accounts.",
  "OSAS is the one office whose head is not an office_staff account: osas@parsu.edu.ph (role osas) is Office.headUserRef for OSAS, per BR — VPAA/VPAF/OSAS retain their own software role even while acting as an office head.",
]);

h1("Role Summary");
table(["Role", "Code", "Scope", "Summary"], roleRows, [78, 88, 105, 244]);

h1("What Each Role Can Do");

h2("Student");
bullets([
  "Access /student pages: dashboard, My Complaints, Submit Complaint, Feedback, notifications, and profile settings.",
  "Create complaints. The system validates category/routing/SLA configuration, assigns a ticket number, routes the complaint to an office, and notifies the student and routed office.",
  "View only their own complaints and complaint timelines.",
  "Edit title/description or withdraw a complaint only while it is still submitted and before staff action.",
  "Upload and access attachments only for their own accessible complaints.",
  "Rate a complaint only after it is resolved, and only once.",
  "Submit standalone feedback and view their own unarchived feedback.",
  "Cannot access staff or admin pages; cannot add internal notes, assign complaints, update status, or generate reports.",
]);

h2("Office Staff");
bullets([
  "Access /staff pages: dashboard, office queue, SLA page, notifications, and profile settings.",
  "View complaints assigned to their own office only.",
  "Pick up or assign a complaint to staff in the same office; cannot move complaints to another office.",
  "Update complaint status within the allowed lifecycle, including progress, pending information, resolved, closed, and reopen paths where valid.",
  "Add and read internal notes for complaints in their office. Students never see internal notes.",
  "Generate PDF, Excel, and CSV reports scoped to their own office and see only reports they created.",
  "Receive and manage own notifications.",
  "Cannot access admin CRUD/configuration pages; cannot create users, offices, categories, routing rules, SLA rules, settings, audit logs, or announcements.",
]);

h2("Administrator");
bullets([
  "Can access every route, including student, staff, and admin areas.",
  "Admin dashboard and analytics are unrestricted across all offices, students, complaints, feedback, and SLA data.",
  "Manage all users: create, edit, deactivate/reactivate, reset passwords, and force logout.",
  "Manage all offices, office heads, categories, routing rules, SLA rules, settings, announcements, feedback archive state, audit logs, reports, and complaints.",
  "View and mutate any complaint where the relevant operation supports mutation: status changes, assignment, reassignment, escalation, notes, attachments, archiving, and reporting.",
  "Generate reports across all data, subject only to selected report filters.",
]);

h2("VPAA");
bullets([
  "Uses the admin area but is scoped to college_office data.",
  "Can view dashboard, complaints, reports, users, offices, notifications, and profile pages within scope.",
  "Can read full complaint details, notes, and attachments for complaints assigned to college offices.",
  "Can assign/reassign college-office complaints to active college offices and staff in the target office.",
  "Can create and manage office_staff users only for college offices.",
  "Can create/manage offices only in the college_office category.",
  "Can generate reports constrained to college-office IDs.",
  "Cannot access administrator-only configuration: categories, routing rules, SLA rules, settings, announcements broadcast, and audit logs.",
]);

h2("VPAF");
bullets([
  "Uses the admin area but is scoped to university_office data.",
  "Can view dashboard, complaints, reports, users, offices, notifications, and profile pages within scope.",
  "Can read full complaint details, notes, and attachments for complaints assigned to university offices.",
  "Can assign/reassign university-office complaints to active university offices and staff in the target office.",
  "Can create and manage office_staff users only for university offices.",
  "Can create/manage offices only in the university_office category.",
  "Can generate reports constrained to university-office IDs.",
  "Cannot access administrator-only configuration: categories, routing rules, SLA rules, settings, announcements broadcast, and audit logs.",
]);

h2("OSAS");
bullets([
  "Uses the admin area with student-domain scope.",
  "Can view dashboard, complaints, reports, users, feedback, notifications, and profile pages.",
  "Can manage student accounts only; cannot create staff or administrative users.",
  "Can read complaint details, notes, and attachments across complaints because OSAS scope is framed around student affairs rather than one office category.",
  "Can reassign complaints only when they are inside OSAS student-affairs action scope and only to allowed destination offices.",
  "Can escalate OSAS-scoped complaints only to the configured VPAA/escalation destination.",
  "Can view standalone student feedback; VPAA and VPAF do not receive feedback access because feedback has no office/college link.",
  "Cannot access Offices management, administrator-only configuration, announcements broadcast, or audit logs.",
]);

h1("Seed Accounts");
p("Use these accounts after running the development seed endpoint. Unless marked inactive, each account can sign in with the shared seed password.");
table(["Email", "Role", "Status", "Name", "Office / Scope"], accountRows, [148, 78, 50, 94, 145]);

h1("Office Staff Routing Accounts");
p("\"Head\" is the account referenced by Office.headUserRef for that office (only a head can Assign Staff, Change Assignee, or Reassign Office). \"Staff\" lists the ordinary, non-head office_staff accounts.");
table(
  ["Office / head", "Routing categories", "Staff accounts (non-head)"],
  [
    ["CECS | Head: Noel Aguilar (staff5@)", "Faculty & Teaching Performance", "staff8@parsu.edu.ph"],
    ["CED | Head: Andrea Castillo (dean.ced@)", "Faculty & Teaching Performance - College of Education", "staff9@parsu.edu.ph"],
    ["CBM | Head: Christian Mendoza (dean.cbm@)", "Faculty & Teaching Performance - College of Business & Management", "staff10@parsu.edu.ph"],
    ["COS | Head: Rosa Navarro (dean.cos@)", "Faculty & Teaching Performance - College of Science", "staff11@parsu.edu.ph"],
    ["CAH | Head: Katrina Ocampo (dean.cah@)", "Faculty & Teaching Performance - College of Arts and Humanities", "staff12@parsu.edu.ph"],
    ["OUR | Head: Maria Santos (staff@)", "Grade Concern; Document Request Delays; Staff Service & Responsiveness; Administrative Process Concerns", "staff3@parsu.edu.ph, staff17@parsu.edu.ph"],
    ["OSAS | Head: Cristina Bautista (osas@, role=osas)", "Campus Safety & Security; Student Services & Assistance; Health & Medical Services; Scholarships & Financial Assistance", "staff2@parsu.edu.ph"],
    ["OVPAA | Head: Carlos Mercado (staff6@)", "Curriculum & Class Scheduling; Academic Advising & Consultation; Library Services & Resources", "staff13@parsu.edu.ph"],
    ["OVPAF | Head: Bea Salonga (staff7@)", "Student Payment & Cashier Concerns", "staff14@parsu.edu.ph"],
    ["GSO | Head: Liza Domingo (staff4@)", "Classroom & Laboratory Facilities; Restroom & Sanitation; Campus Wi-Fi & IT Infrastructure", "staff16@parsu.edu.ph"],
    ["QAO | Head: Elena Reyes (qa@)", "No direct routing category; quality-assurance staff account", "staff15@parsu.edu.ph"],
  ],
  [150, 235, 130],
);

h1("Implementation Sources Used");
bullets([
  "src/lib/constants.ts for role names and status constants.",
  "src/middleware/rbac.ts for route-level access.",
  "src/lib/api-guards.ts and src/lib/admin-scope.ts for administrator and scoped sub-admin behavior.",
  "src/app/api/complaints/** for complaint creation, reading, status changes, ratings, notes, and assignment scopes.",
  "src/app/api/admin/** for user, office, category, settings, audit-log, and announcement guard behavior.",
  "src/app/api/reports/export/route.ts for report generation permissions and data scoping.",
  "src/app/api/dev/seed/route.ts for seeded account emails, names, offices, status, generated students, and shared seed password.",
]);

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.font("Helvetica").fontSize(8).fillColor(colors.muted);
  doc.text(
    `ParSU e-Feedback Role Capabilities and Seed Accounts | Page ${i + 1} of ${range.count}`,
    doc.page.margins.left,
    doc.page.height - 34,
    { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
  );
}

doc.end();
console.log(outputPath);
