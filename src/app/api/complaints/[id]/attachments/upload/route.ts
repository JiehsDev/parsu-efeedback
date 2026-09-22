import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { r2Client, isR2Configured } from "@/lib/r2";
import { env } from "@/lib/env";
import { Complaint } from "@/models/Complaint";
import { Attachment } from "@/models/Attachment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { getSettings } from "@/features/settings/services/settings.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

// Information responses use a same-origin multipart upload so the browser
// never has to PUT directly to R2. This avoids storage CORS failures on the
// student complaint detail page while preserving the existing presigned flow
// for new complaint submissions.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isR2Configured() || !r2Client) {
    return NextResponse.json(
      { error: "File uploads are not configured yet.", code: "R2_NOT_CONFIGURED" },
      { status: 501 },
    );
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "student") {
    return NextResponse.json({ error: "Only the complaint owner can upload here." }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (String(complaint.studentRef) !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (complaint.isArchived) {
    return NextResponse.json({ error: "Archived complaints are read-only until restored." }, { status: 403 });
  }

  const form = await req.formData();
  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const settings = await getSettings();
  const mimeType = entry.type || "application/octet-stream";
  if (!settings.uploadAllowedMimeTypes.includes(mimeType)) {
    return NextResponse.json({ error: `File type ${mimeType} is not allowed` }, { status: 400 });
  }
  const maxBytes = settings.uploadMaxFileSizeMb * 1024 * 1024;
  if (entry.size <= 0 || entry.size > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${settings.uploadMaxFileSizeMb}MB` },
      { status: 400 },
    );
  }

  const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `complaints/${id}/${Date.now()}-${safeName}`;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: mimeType,
      Body: Buffer.from(await entry.arrayBuffer()),
    }),
  );

  const attachment = await Attachment.create({
    complaintRef: id,
    uploadedByRef: session.user.id,
    fileUrl: `${env.R2_PUBLIC_URL}/${objectKey}`,
    fileName: entry.name,
    mimeType,
    sizeBytes: entry.size,
  });

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "attachment_added",
    actorRef: session.user.id,
    message: entry.name,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "attachment.create",
    entityType: "Attachment",
    entityId: attachment._id,
    afterState: {
      complaintRef: id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
