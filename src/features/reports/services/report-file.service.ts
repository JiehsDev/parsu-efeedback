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
  { key: "studentName", label: "Student" },
  { key: "submittedAt", label: "Submitted" },
  { key: "resolvedAt", label: "Resolved" },
  { key: "slaCompliant", label: "SLA Met" },
] as const;

export function generateCsv(rows: ReportRow[]): Buffer {
  const header = COLUMNS.map((c) => c.label).join(",");
  const lines = rows.map((row) =>
    COLUMNS.map((c) => {
      const value = String((row as any)[c.key] ?? "");
      // Escape commas/quotes per basic CSV rules
      return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(","),
  );
  return Buffer.from([header, ...lines].join("\n"), "utf-8");
}

export async function generateExcel(rows: ReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.columns = COLUMNS.map((c) => ({ header: c.label, key: c.key, width: 20 }));
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

    const colWidths = [90, 140, 70, 60, 110, 110, 110, 70, 70, 55];
    const startX = doc.page.margins.left;
    let y = doc.y;

    doc.fontSize(8).font("Helvetica-Bold");
    let x = startX;
    COLUMNS.forEach((col, i) => {
      doc.text(col.label, x, y, { width: colWidths[i] });
      if (colWidths[i]) {
        x += colWidths[i];
      }
    });
    y += 15;
    doc
      .moveTo(startX, y)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y)
      .stroke();
    y += 5;

    doc.font("Helvetica").fontSize(7);
    rows.forEach((row) => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      x = startX;
      COLUMNS.forEach((col, i) => {
        doc.text(String((row as any)[col.key] ?? ""), x, y, { width: colWidths[i] });
        if (colWidths[i]) {
          x += colWidths[i];
        }
      });
      y += 14;
    });

    doc.end();
  });
}
