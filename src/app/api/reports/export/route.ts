// src/app/api/reports/export/route.ts — POST handler, fixed
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { GeneratedReport } from "@/models/GeneratedReport";
import { exportReportSchema } from "@/features/reports/schemas/report.schema";
import { queryReportData } from "@/features/reports/services/report-data.service";
import {
  generateCsv,
  generateExcel,
  generatePdf,
} from "@/features/reports/services/report-file.service";
import { uploadReportFile } from "@/features/reports/services/report-upload.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, officeRef, collegeRef } = session.user;

  if (role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await req.json();
  const parsed = exportReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reportType, format, filters } = parsed.data;

  const scopedFilters = { ...filters };
  if (role === "office_staff") {
    scopedFilters.officeRef = officeRef;
    scopedFilters.collegeRef = null;
  } else if (role === "college_dean") {
    scopedFilters.collegeRef = collegeRef;
    scopedFilters.officeRef = filters.officeRef ?? null;
  }

  // Everything — including report creation — now wrapped, so any failure
  // always returns a real JSON error instead of crashing silently.
  let report;
  try {
    report = await GeneratedReport.create({
      creatorRef: session.user.id,
      reportType,
      format,
      filters: scopedFilters,
      status: "generating",
    });

    const rows = await queryReportData(scopedFilters);

    let buffer: Buffer;
    if (format === "csv") buffer = generateCsv(rows);
    else if (format === "excel") buffer = await generateExcel(rows);
    else buffer = await generatePdf(rows, reportType);

    const downloadUrl = await uploadReportFile(buffer, format, String(report._id));

    report.status = "ready";
    report.downloadUrl = downloadUrl;
    await report.save();

    await writeAuditLog({
      actorId: session.user.id,
      action: "report.generate",
      entityType: "GeneratedReport",
      entityId: report._id,
      afterState: { reportType, format, rowCount: rows.length },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Report generation error:", error);

    if (report) {
      report.status = "failed";
      await report.save().catch(() => {});
    }

    return NextResponse.json(
      {
        error: "Report generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const reports = await GeneratedReport.find({ creatorRef: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({ reports });
}
