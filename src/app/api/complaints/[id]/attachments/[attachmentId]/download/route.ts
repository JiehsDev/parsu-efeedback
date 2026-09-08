// src/app/api/complaints/[id]/attachments/[attachmentId]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { r2Client, isR2Configured } from "@/lib/r2";
import { env } from "@/lib/env";
import { Complaint } from "@/models/Complaint";
import { Attachment } from "@/models/Attachment";
import { getAdminScope, isComplaintInAdminScope } from "@/lib/admin-scope";

// Hardcoded independently of the admin-configurable upload allow-list:
// rendering a response inline (rather than forcing a download) is only
// safe for types a browser can't be tricked into executing as script.
// SVG is deliberately excluded — inline SVG can carry <script>.
const INLINE_SAFE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

async function canAccessComplaint(session: any, complaint: any): Promise<boolean> {
  const { role, id, officeRef } = session.user;
  if (role === "administrator" || role === "qa_office") return true;
  if (role === "student") return String(complaint.studentRef) === id;
  if (role === "office_staff") return String(complaint.assignedOfficeRef) === officeRef;
  // QA-style access, scoped to each sub-admin's own category.
  if (role === "vpaa" || role === "vpaf" || role === "osas") {
    return isComplaintInAdminScope(getAdminScope(role), complaint);
  }
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id, attachmentId } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachment = await Attachment.findOne({ _id: attachmentId, complaintRef: id }).lean();
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  if (!isR2Configured() || !r2Client) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 501 });
  }

  // Attachments were stored as full public URLs (Phase 12) — extract the
  // object key by stripping the known public-URL prefix, so this route
  // still works with existing records without a data migration.
  const fileUrl = (attachment as any).fileUrl as string;
  const key = fileUrl.startsWith(env.R2_PUBLIC_URL)
    ? fileUrl.slice(env.R2_PUBLIC_URL.length + 1)
    : fileUrl;

  const object = await r2Client.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
  const bytes = await object.Body!.transformToByteArray();

  // Never trust the stored mimeType for inline rendering — it's set from
  // client input at attachment-creation time, and serving arbitrary
  // attacker-controlled content inline from our own origin is a stored-XSS
  // vector against whoever else opens this complaint's attachments.
  const mimeType = (attachment as any).mimeType ?? "application/octet-stream";
  const disposition = INLINE_SAFE_MIME_TYPES.has(mimeType) ? "inline" : "attachment";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": disposition === "inline" ? mimeType : "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${(attachment as any).fileName}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
