// src/app/api/reports/[id]/print/route.ts
//
// A print-friendly HTML rendering of a generated report's data, opened in a
// new tab from the "Print" button beside "Download" in ReportsPanel.tsx.
// Reuses the same query as the CSV/Excel/PDF export (report-data.service.ts)
// against the report's stored (already role-scoped) filters, rather than
// re-reading the generated file — this sidesteps needing an `inline`
// disposition variant of the R2 download endpoint, and works uniformly
// regardless of which format was originally generated.
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { GeneratedReport } from "@/models/GeneratedReport";
import { queryReportData, type ReportRow } from "@/features/reports/services/report-data.service";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COLUMNS: { key: keyof ReportRow; label: string }[] = [
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
  { key: "slaCompliant", label: "SLA Met" },
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await params;

  const report = await GeneratedReport.findById(id).lean();
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same ownership rule as the download route (BR-078): only the creator or
  // an administrator may view it.
  const isOwner = String((report as any).creatorRef) === session.user.id;
  const isAdmin = session.user.role === "administrator";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await queryReportData((report as any).filters ?? {});
  const title = `${String((report as any).reportType).replace(/-/g, " ")} report`;
  const generatedAt = new Date((report as any).createdAt).toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; text-transform: capitalize; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; white-space: nowrap; }
  th { background: #f2f2f2; }
  tbody tr:nth-child(even) { background: #fafafa; }
  @media print {
    body { margin: 0.5in; }
    .no-print { display: none; }
  }
  .no-print { margin-bottom: 16px; }
  button { font: inherit; padding: 6px 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Print</button></div>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Generated ${escapeHtml(generatedAt)} &middot; ${rows.length} row${rows.length === 1 ? "" : "s"}</p>
  <table>
    <thead>
      <tr>${COLUMNS.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${COLUMNS.map((c) => `<td>${escapeHtml(String(row[c.key] ?? ""))}</td>`).join("")}</tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
