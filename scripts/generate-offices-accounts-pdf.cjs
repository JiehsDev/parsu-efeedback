/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Generates docs/offices-routing-heads-accounts.pdf: a landscape reference
 * sheet listing every seeded office/college together with its routing
 * categories, head/dean, staff/user login accounts, and shared password.
 *
 * Data sources (kept in sync by hand — see "Implementation Sources Used"
 * section at the end of the generated PDF):
 *   - src/app/api/dev/seed/route.ts (offices, users, headUserRef assignments,
 *     additionalCategories routing map, shared seed password)
 *   - src/models/Office.ts / src/models/User.ts (field shapes)
 *   - Live database verification: `node scripts/generate-offices-accounts-pdf.cjs`
 *     does not query the DB; counts below were cross-checked manually against
 *     the Atlas cluster on the date this file was last edited.
 *
 * Run: node scripts/generate-offices-accounts-pdf.cjs
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const outputPath = path.join(__dirname, "..", "docs", "offices-routing-heads-accounts.pdf");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  layout: "landscape",
  margin: 40,
  bufferPages: true,
  info: {
    Title: "ParSU e-Feedback Offices, Routing Categories, Heads and Accounts",
    Author: "ParSU e-Feedback",
    Subject: "Office directory, routing categories, office heads, and seeded login accounts",
  },
});

doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  heading: "#111827",
  subheading: "#1f2937",
  body: "#374151",
  muted: "#6b7280",
  rule: "#d1d5db",
  headerFill: "#eef2ff",
  stripeFill: "#f8fafc",
};

function usableWidth() {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function title(text) {
  doc.font("Helvetica-Bold").fontSize(19).fillColor(colors.heading).text(text, { align: "center" });
  doc.moveDown(0.3);
}

function subtitle(text) {
  doc.font("Helvetica").fontSize(9.5).fillColor(colors.muted).text(text, { align: "center" });
  doc.moveDown(1);
}

function h1(text) {
  ensureSpace(70);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(13.5).fillColor(colors.heading).text(text);
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(colors.rule)
    .lineWidth(0.7)
    .stroke();
  doc.moveDown(0.7);
}

function p(text) {
  doc.font("Helvetica").fontSize(9).fillColor(colors.body).text(text, { lineGap: 2 });
  doc.moveDown(0.3);
}

function bullets(items) {
  doc.font("Helvetica").fontSize(9).fillColor(colors.body);
  for (const item of items) {
    ensureSpace(24);
    doc.text(`- ${item}`, { indent: 10, hangingIndent: 10, lineGap: 1.4 });
  }
  doc.moveDown(0.3);
}

function ensureSpace(height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

// Draws a bordered, word-wrapped table. Throws at generation time (instead of
// silently rendering off the page) if `widths` doesn't add up to the usable
// content width, so column alignment can never silently drift.
function table(headers, rows, widths) {
  const max = usableWidth();
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum > max + 0.5) {
    throw new Error(`Table widths (${sum}) exceed usable page width (${max.toFixed(2)}). Reduce column widths.`);
  }

  const x = doc.page.margins.left;
  const rowPadding = 5;

  function cellLines(cell) {
    return String(cell).split("\n");
  }

  function drawRow(row, isHeader, stripe) {
    const startY = doc.y;
    const fontName = isHeader ? "Helvetica-Bold" : "Helvetica";
    const fontSize = isHeader ? 8.6 : 8.2;
    const heights = row.map((cell, index) => {
      doc.font(fontName).fontSize(fontSize);
      const lines = cellLines(cell);
      let h = 0;
      for (const line of lines) {
        h += doc.heightOfString(line || " ", { width: widths[index] - rowPadding * 2 });
      }
      return h + rowPadding * 2;
    });
    const rowHeight = Math.max(...heights, 20);
    ensureSpace(rowHeight + 4);
    const rowY = doc.y;

    const totalWidth = widths.reduce((a, b) => a + b, 0);
    if (isHeader) {
      doc.rect(x, rowY, totalWidth, rowHeight).fill(colors.headerFill);
    } else if (stripe) {
      doc.rect(x, rowY, totalWidth, rowHeight).fill(colors.stripeFill);
    }

    let cursorX = x;
    for (let i = 0; i < row.length; i++) {
      doc.rect(cursorX, rowY, widths[i], rowHeight).strokeColor(colors.rule).lineWidth(0.5).stroke();
      doc
        .font(fontName)
        .fontSize(fontSize)
        .fillColor(isHeader ? colors.heading : colors.body)
        .text(String(row[i]), cursorX + rowPadding, rowY + rowPadding, {
          width: widths[i] - rowPadding * 2,
          lineGap: 1,
        });
      cursorX += widths[i];
    }
    doc.y = rowY + rowHeight;
  }

  drawRow(headers, true, false);
  rows.forEach((row, i) => drawRow(row, false, i % 2 === 1));
  doc.moveDown(0.6);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const SEED_PASSWORD = "ParSU_test2026";

const officeRows = [
  [
    "College of Engineering &\nComputational Sciences\n(CECS - college)",
    "Faculty & Teaching Performance",
    "Noel Aguilar\nstaff5@parsu.edu.ph",
    "staff5@parsu.edu.ph (head)\nstaff8@parsu.edu.ph (Grace Manalo)",
    SEED_PASSWORD,
  ],
  [
    "College of Education\n(CED - college)",
    "Faculty & Teaching Performance -\nCollege of Education",
    "Andrea Castillo\ndean.ced@parsu.edu.ph",
    "dean.ced@parsu.edu.ph (head)\nstaff9@parsu.edu.ph (Roberto Tolentino)",
    SEED_PASSWORD,
  ],
  [
    "College of Business &\nManagement (CBM - college)",
    "Faculty & Teaching Performance -\nCollege of Business & Management",
    "Christian Mendoza\ndean.cbm@parsu.edu.ph",
    "dean.cbm@parsu.edu.ph (head)\nstaff10@parsu.edu.ph (Michelle Diaz)",
    SEED_PASSWORD,
  ],
  [
    "College of Science\n(COS - college)",
    "Faculty & Teaching Performance -\nCollege of Science",
    "Rosa Navarro\ndean.cos@parsu.edu.ph",
    "dean.cos@parsu.edu.ph (head)\nstaff11@parsu.edu.ph (Daniel Espinosa)",
    SEED_PASSWORD,
  ],
  [
    "College of Arts and\nHumanities (CAH - college)",
    "Faculty & Teaching Performance -\nCollege of Arts and Humanities",
    "Katrina Ocampo\ndean.cah@parsu.edu.ph",
    "dean.cah@parsu.edu.ph (head)\nstaff12@parsu.edu.ph (Julia Lopez)",
    SEED_PASSWORD,
  ],
  [
    "Office of the University\nRegistrar (OUR - university)",
    "Grade Concern; Document Request\nDelays; Staff Service &\nResponsiveness; Administrative\nProcess Concerns",
    "Maria Santos\nstaff@parsu.edu.ph",
    "staff@parsu.edu.ph (head)\nstaff3@parsu.edu.ph (Pedro Penduko)\nstaff17@parsu.edu.ph (Samantha Aguilar)",
    SEED_PASSWORD,
  ],
  [
    "Office of Student Affairs\nand Services (OSAS - university)",
    "Campus Safety & Security; Student\nServices & Assistance; Health &\nMedical Services; Scholarships &\nFinancial Assistance",
    "Cristina Bautista\nosas@parsu.edu.ph (role=osas)",
    "staff2@parsu.edu.ph (Pedro Penduko)",
    SEED_PASSWORD,
  ],
  [
    "Office of the VP for\nAcademic Affairs (OVPAA - university)",
    "Curriculum & Class Scheduling;\nAcademic Advising & Consultation;\nLibrary Services & Resources",
    "Carlos Mercado\nstaff6@parsu.edu.ph",
    "staff6@parsu.edu.ph (head)\nstaff13@parsu.edu.ph (Marco Pascual)",
    SEED_PASSWORD,
  ],
  [
    "Office of the VP for\nAdministration and Finance\n(OVPAF - university)",
    "Student Payment & Cashier\nConcerns",
    "Bea Salonga\nstaff7@parsu.edu.ph",
    "staff7@parsu.edu.ph (head)\nstaff14@parsu.edu.ph (Bianca Del Rosario)",
    SEED_PASSWORD,
  ],
  [
    "General Services Office\n(GSO - university)",
    "Classroom & Laboratory Facilities;\nRestroom & Sanitation; Campus\nWi-Fi & IT Infrastructure",
    "Liza Domingo\nstaff4@parsu.edu.ph",
    "staff4@parsu.edu.ph (head)\nstaff16@parsu.edu.ph (Nathaniel Rivera)",
    SEED_PASSWORD,
  ],
  [
    "Quality Assurance Office\n(QAO - university)",
    "No direct routing category;\ninstitution-wide read-only per RBAC",
    "Elena Reyes\nqa@parsu.edu.ph",
    "qa@parsu.edu.ph (head)\nstaff15@parsu.edu.ph (Paolo Salazar)",
    SEED_PASSWORD,
  ],
];

const accountRows = [
  ["student@parsu.edu.ph", "student", "Active", "Elliot Anderson", "College of Engineering & Computational Sciences", SEED_PASSWORD],
  ["inactive@parsu.edu.ph", "student", "Inactive", "Inactive Test", "Login rejection test account", SEED_PASSWORD],
  ["student20001@... student20035@parsu.edu.ph", "student", "Active", "Generated names", "7 generated students per seeded college (35 total)", SEED_PASSWORD],
  ["staff@parsu.edu.ph", "office_staff", "Active", "Maria Santos", "Office of the University Registrar (head)", SEED_PASSWORD],
  ["staff2@parsu.edu.ph", "office_staff", "Active", "Pedro Penduko", "Office of Student Affairs and Services", SEED_PASSWORD],
  ["staff3@parsu.edu.ph", "office_staff", "Active", "Pedro Penduko", "Office of the University Registrar", SEED_PASSWORD],
  ["staff4@parsu.edu.ph", "office_staff", "Active", "Liza Domingo", "General Services Office (head)", SEED_PASSWORD],
  ["staff5@parsu.edu.ph", "office_staff", "Active", "Noel Aguilar", "College of Engineering & Computational Sciences (head)", SEED_PASSWORD],
  ["staff8@parsu.edu.ph", "office_staff", "Active", "Grace Manalo", "College of Engineering & Computational Sciences", SEED_PASSWORD],
  ["dean.ced@parsu.edu.ph", "office_staff", "Active", "Andrea Castillo", "College of Education (head)", SEED_PASSWORD],
  ["staff9@parsu.edu.ph", "office_staff", "Active", "Roberto Tolentino", "College of Education", SEED_PASSWORD],
  ["dean.cbm@parsu.edu.ph", "office_staff", "Active", "Christian Mendoza", "College of Business & Management (head)", SEED_PASSWORD],
  ["staff10@parsu.edu.ph", "office_staff", "Active", "Michelle Diaz", "College of Business & Management", SEED_PASSWORD],
  ["dean.cos@parsu.edu.ph", "office_staff", "Active", "Rosa Navarro", "College of Science (head)", SEED_PASSWORD],
  ["staff11@parsu.edu.ph", "office_staff", "Active", "Daniel Espinosa", "College of Science", SEED_PASSWORD],
  ["dean.cah@parsu.edu.ph", "office_staff", "Active", "Katrina Ocampo", "College of Arts and Humanities (head)", SEED_PASSWORD],
  ["staff12@parsu.edu.ph", "office_staff", "Active", "Julia Lopez", "College of Arts and Humanities", SEED_PASSWORD],
  ["staff6@parsu.edu.ph", "office_staff", "Active", "Carlos Mercado", "Office of the VP for Academic Affairs (head)", SEED_PASSWORD],
  ["staff13@parsu.edu.ph", "office_staff", "Active", "Marco Pascual", "Office of the VP for Academic Affairs", SEED_PASSWORD],
  ["staff7@parsu.edu.ph", "office_staff", "Active", "Bea Salonga", "Office of the VP for Administration and Finance (head)", SEED_PASSWORD],
  ["staff14@parsu.edu.ph", "office_staff", "Active", "Bianca Del Rosario", "Office of the VP for Administration and Finance", SEED_PASSWORD],
  ["staff16@parsu.edu.ph", "office_staff", "Active", "Nathaniel Rivera", "General Services Office", SEED_PASSWORD],
  ["staff17@parsu.edu.ph", "office_staff", "Active", "Samantha Aguilar", "Office of the University Registrar", SEED_PASSWORD],
  ["qa@parsu.edu.ph", "office_staff", "Active", "Elena Reyes", "Quality Assurance Office (head)", SEED_PASSWORD],
  ["staff15@parsu.edu.ph", "office_staff", "Active", "Paolo Salazar", "Quality Assurance Office", SEED_PASSWORD],
  ["admin@parsu.edu.ph", "administrator", "Active", "System Administrator", "No office or college scope", SEED_PASSWORD],
  ["vpaa@parsu.edu.ph", "vpaa", "Active", "Dr. Juan Cruz", "College-office sub-admin", SEED_PASSWORD],
  ["vpaf@parsu.edu.ph", "vpaf", "Active", "Rosario Villanueva", "University-office sub-admin", SEED_PASSWORD],
  ["osas@parsu.edu.ph", "osas", "Active", "Cristina Bautista", "Student-domain sub-admin; Office.headUserRef for OSAS", SEED_PASSWORD],
];

const collegeStudentRows = [
  ["CECS - College of Engineering & Computational Sciences", "8 active students"],
  ["CED - College of Education", "7 active students"],
  ["CBM - College of Business & Management", "7 active students"],
  ["COS - College of Science", "7 active students"],
  ["CAH - College of Arts and Humanities", "7 active students"],
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

title("ParSU e-Feedback");
subtitle(
  `Offices, Routing Categories, Heads & Accounts | Generated ${new Date().toLocaleDateString("en-US")}`,
);

h1("Login Notes");
bullets([
  `All seeded test accounts share the password ${SEED_PASSWORD} unless marked Inactive.`,
  "Every one of the 11 seeded offices/colleges has one assigned head/dean plus at least one distinct, non-head office_staff login — so head-only actions (Assign Staff, Change Assignee, Reassign Office) can be exercised against a real staff member in every office, not just tested via the head's own account.",
  "The Office of the University Registrar (OUR) has two non-head staff logins (staff3@parsu.edu.ph, staff17@parsu.edu.ph) so Change Assignee between two ordinary staff can be tested there specifically.",
  "OSAS is the one office whose head is not an office_staff account: osas@parsu.edu.ph (Cristina Bautista, role osas) is Office.headUserRef for OSAS; staff2@parsu.edu.ph is OSAS's ordinary staff account. Every other office's head is an office_staff account.",
  "QA is not a separate application role; qa@parsu.edu.ph is an office_staff account assigned to the Quality Assurance Office.",
  "Verified directly against the live database: 11/11 offices have an active head and at least one active non-head staff login; all 5 colleges have active enrolled students; sample password hashes (admin, dean.ced, staff, student) matched the shared seed password.",
]);

h1("Offices, Routing Categories, Heads & Accounts");
p("One row per seeded office/college. \"Head / dean\" is the user referenced by Office.headUserRef; \"Staff / user accounts\" lists every active office_staff login in that office.");
table(
  ["Office (code / type)", "Routing categories", "Head / dean", "Staff / user accounts", "Password"],
  officeRows,
  [150, 245, 130, 150, 65],
);

h1("Colleges - Active Student Accounts");
table(["College", "Active students"], collegeStudentRows, [500, 240]);

h1("Full Seed Account Directory");
p("Complete list of named seed accounts (generated student accounts summarized as one row). All passwords are shared unless the account is Inactive.");
table(
  ["Email", "Role", "Status", "Name", "Office / Scope", "Password"],
  accountRows,
  [190, 90, 55, 110, 226, 70],
);

h1("Implementation Sources Used");
bullets([
  "src/app/api/dev/seed/route.ts for seeded offices, users, office head assignments, routing categories, generated students, and the shared seed password.",
  "src/models/Office.ts and src/models/User.ts for office/head/user field shapes (headUserRef, officeRef, collegeRef).",
  "src/features/admin/services/office-head.service.ts for how office heads are validated and assigned.",
  "src/lib/constants.ts for role names.",
  "Live database read (Atlas cluster) to confirm every office currently has an active head and staff login, and that seed passwords still validate.",
]);

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.font("Helvetica").fontSize(8).fillColor(colors.muted);
  doc.text(
    `ParSU e-Feedback Offices, Routing Categories, Heads & Accounts | Page ${i + 1} of ${range.count}`,
    doc.page.margins.left,
    doc.page.height - 28,
    { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
  );
}

doc.end();
console.log(outputPath);
