// src/features/reports/services/report-file.service.ts
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { ReportRow } from "./report-data.service";

const COLUMNS = [
  { key: "ticketNumber", label: "Ticket" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "officeName", label: "Office" },
  { key: "categoryName", label: "Category" },
  { key: "studentId", label: "Student ID" },
  { key: "studentCollege", label: "College" },
  { key: "submittedAt", label: "Submitted" },
  { key: "resolvedAt", label: "Resolved" },
  { key: "resolutionSummary", label: "Resolution details" },
  { key: "slaCompliant", label: "SLA Met" },
] as const;

export function generateCsv(rows: ReportRow[]): Buffer {
  const header = COLUMNS.map((c) => c.label).join(",");
  const lines = rows.map((row) =>
    COLUMNS.map((c) => {
      const value = String((row as any)[c.key] ?? "");
      // Escape commas/quotes per basic CSV rules
      return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(","),
  );
  return Buffer.from([header, ...lines].join("\n"), "utf-8");
}

export async function generateExcel(rows: ReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.columns = COLUMNS.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.key === "resolutionSummary" ? 60 : 20,
  }));
  sheet.getColumn("resolutionSummary").alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePdf(rows: ReportRow[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1.5);

    // Flowing text lets long, multiline resolutions span pages without
    // overlapping subsequent complaints or clipping at a fixed row height.
    rows.forEach((row, index) => {
      if (index > 0) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(11).text(`${row.ticketNumber} - ${row.title}`);
      doc.moveDown(0.5);
      COLUMNS.filter((col) => col.key !== "ticketNumber" && col.key !== "title").forEach((col) => {
        doc.font("Helvetica-Bold").fontSize(9).text(`${col.label}:`);
        doc
          .font("Helvetica")
          .fontSize(9)
          .text(String(row[col.key] ?? ""));
        doc.moveDown(0.5);
      });
    });

    doc.end();
  });
}
