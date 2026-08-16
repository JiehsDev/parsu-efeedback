// src/app/api/uploads/presign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { r2Client, isR2Configured } from "@/lib/r2";
import { env } from "@/lib/env";
import { Complaint } from "@/models/Complaint";
import { presignUploadSchema } from "@/features/attachments/schemas/attachment.schema";
import { User } from "@/models";
import { getSettings } from "@/features/settings/services/settings.service";

export async function POST(req: NextRequest) {
  if (!isR2Configured() || !r2Client) {
    return NextResponse.json(
      {
        error: "File uploads are not configured yet. Set R2 credentials in .env.local.",
        code: "R2_NOT_CONFIGURED",
      },
      { status: 501 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const settings = await getSettings();

  const body = await req.json();
  const parsed = presignUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { complaintId, fileName, mimeType, sizeBytes } = parsed.data;

  // BR-060/061: validate against configured allow-list/max size before
  // issuing a presigned URL at all
  if (!settings.uploadAllowedMimeTypes.includes(mimeType)) {
    return NextResponse.json({ error: `File type ${mimeType} is not allowed` }, { status: 400 });
  }
  const maxBytes = settings.uploadMaxFileSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${settings.uploadMaxFileSizeMb}MB` },
      { status: 400 },
    );
  }

  // Validate the user actually owns/can access this complaint before
  // letting them attach anything to it
  const complaint = await Complaint.findById(complaintId).lean();
  if (!complaint) {
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  }

  const { role, id: userId, officeRef, collegeRef } = session.user;
  let canAccess = false;
  if (role === "administrator" || role === "qa_office") {
    canAccess = true;
  } else if (role === "student") {
    canAccess = String((complaint as any).studentRef) === userId;
  } else if (role === "office_staff") {
    canAccess = String((complaint as any).assignedOfficeRef) === officeRef;
  } else if (role === "college_dean") {
    const student = await User.findById((complaint as any).studentRef).lean();
    canAccess = Boolean(student) && String((student as any).collegeRef) === collegeRef;
  }
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const objectKey = `complaints/${complaintId}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 }); // 5 min

  const fileUrl = `${env.R2_PUBLIC_URL}/${objectKey}`;

  return NextResponse.json({ uploadUrl, fileUrl, objectKey });
}
