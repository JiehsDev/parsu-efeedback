// src/features/reports/services/report-file.service.test.ts
// BR-079: report generation in multiple formats. Pure functions over a
// ReportRow[] array, no DB/network — safe to unit test with hand-built rows.
import { describe, it, expect } from "vitest";
import { generateCsv, generateExcel, generatePdf } from "./report-file.service";
import type { ReportRow } from "./report-data.service";
import ExcelJS from "exceljs";

const rows: ReportRow[] = [
  {
    ticketNumber: "PARSU-2026-000001",
    title: "Broken projector",
    status: "resolved",
    priority: "high",
    officeName: "IT Office",
    categoryName: "Facilities",
    studentId: "2023-10492",
    studentCollege: "College of Engineering",
    submittedAt: "1/1/2026",
    resolvedAt: "1/3/2026",
    resolutionSummary: "Replaced the projector lamp and verified operation.",
    slaCompliant: "Yes",
  },
  {
    ticketNumber: "PARSU-2026-000002",
    title: 'Has, a comma "and quotes"',
    status: "submitted",
    priority: "low",
    officeName: "Registrar",
    categoryName: "Records",
    studentId: "2023-10493",
    studentCollege: "College of Education",
    submittedAt: "1/2/2026",
    resolvedAt: "—",
    resolutionSummary: "",
    slaCompliant: "N/A",
  },
];

describe("report-file.service — BR-079", () => {
  it("generateCsv returns a Buffer whose content has the header row and one line per complaint", () => {
    const buffer = generateCsv(rows);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const text = buffer.toString("utf-8");
    const lines = text.split("\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toBe(
      "Ticket,Title,Status,Priority,Office,Category,Student ID,College,Submitted,Resolved,Resolution details,SLA Met",
    );
    expect(lines[1]).toContain("PARSU-2026-000001");
    expect(lines[1]).toContain("2023-10492");
    // No student name column at all — reports stay anonymized.
    expect(text).not.toContain("Jane Doe");
    expect(text).not.toContain("John Roe");
  });

  it("generateCsv escapes fields containing commas/quotes per basic CSV rules", () => {
    const buffer = generateCsv(rows);
    const text = buffer.toString("utf-8");
    expect(text).toContain('"Has, a comma ""and quotes"""');
  });

  it("generateCsv returns just the header for an empty row set", () => {
    const buffer = generateCsv([]);
    expect(buffer.toString("utf-8")).toBe(
      "Ticket,Title,Status,Priority,Office,Category,Student ID,College,Submitted,Resolved,Resolution details,SLA Met",
    );
  });

  it("generateExcel returns a non-empty Buffer", async () => {
    const buffer = await generateExcel(rows);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("preserves multiline resolution details in CSV and Excel", async () => {
    const resolutionSummary = 'Replaced the lamp.\nConfirmed "working", with student.';
    const data = [{ ...rows[0]!, resolutionSummary }];
    expect(generateCsv(data).toString("utf-8")).toContain(
      '"Replaced the lamp.\nConfirmed ""working"", with student."',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(await generateExcel(data)).buffer);
    const sheet = workbook.worksheets[0]!;
    expect(sheet.getRow(1).getCell(11).value).toBe("Resolution details");
    expect(sheet.getRow(2).getCell(11).value).toBe(resolutionSummary);
    expect(sheet.getRow(2).getCell(11).alignment.wrapText).toBe(true);
  });

  it("exports long resolutions to PDF without a fixed row height", async () => {
    const buffer = await generatePdf(
      [{ ...rows[0]!, resolutionSummary: "Repaired and tested.\n".repeat(200) }, rows[1]!],
      "Resolution report",
    );
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("generatePdf returns a non-empty Buffer", async () => {
    const buffer = await generatePdf(rows, "Complaint Export");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // PDFs start with the %PDF- magic bytes
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
