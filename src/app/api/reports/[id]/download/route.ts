// src/app/api/reports/[id]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { r2Client, isR2Configured } from "@/lib/r2";
import { env } from "@/lib/env";
import { GeneratedReport } from "@/models/GeneratedReport";

const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await params;

  const report = await GeneratedReport.findById(id).lean();
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // BR-078: a report belongs to one user — only its creator (or admin)
  // may download it.
  const isOwner = String((report as any).creatorRef) === session.user.id;
  const isAdmin = session.user.role === "administrator";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if ((report as any).status !== "ready" || !(report as any).downloadUrl) {
    return NextResponse.json({ error: "Report is not ready" }, { status: 400 });
  }

  if (!isR2Configured() || !r2Client) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 501 });
  }

  const key = (report as any).downloadUrl;

  const object = await r2Client.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );

  const bytes = await object.Body!.transformToByteArray();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[(report as any).format] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(report as any).reportType}-${id}.${key.split(".").pop()}"`,
    },
  });
}
