// src/app/api/reports/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { r2Client, isR2Configured } from "@/lib/r2";
import { env } from "@/lib/env";
import { GeneratedReport } from "@/models/GeneratedReport";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await params;

  const report = await GeneratedReport.findById(id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Same ownership rule as the download route: a report belongs to one
  // user — only its creator (or an administrator) may delete it.
  const isOwner = String(report.creatorRef) === session.user.id;
  const isAdmin = session.user.role === "administrator";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Best-effort storage cleanup — a failure here shouldn't block removing
  // the record itself (e.g. the object may already be gone, or storage
  // may be unreachable).
  if (report.downloadUrl && isR2Configured() && r2Client) {
    await r2Client
      .send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: report.downloadUrl }))
      .catch(() => {});
  }

  const beforeState = report.toObject();
  await report.deleteOne();

  await writeAuditLog({
    actorId: session.user.id,
    action: "report.delete",
    entityType: "GeneratedReport",
    entityId: report._id,
    beforeState,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
