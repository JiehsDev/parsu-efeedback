// src/app/api/complaints/[id]/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { Attachment } from "@/models/Attachment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { createAttachmentSchema } from "@/features/attachments/schemas/attachment.schema";
import { getSettings } from "@/features/settings/services/settings.service";
import { getAdminScope, isComplaintInAdminScope } from "@/lib/admin-scope";

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // BR-060: re-enforce the same allow-list the presign step used — the
  // client-declared mimeType here is untrusted and this is a separate,
  // decoupled call, so a presign-only check can be bypassed by presigning
  // as one type and then registering the attachment as another.
  const settings = await getSettings();
  if (!settings.uploadAllowedMimeTypes.includes(parsed.data.mimeType)) {
    return NextResponse.json(
      { error: `File type ${parsed.data.mimeType} is not allowed` },
      { status: 400 },
    );
  }

  const attachment = await Attachment.create({
    complaintRef: id,
    uploadedByRef: session.user.id,
    ...parsed.data,
  });

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "attachment_added",
    actorRef: session.user.id,
    message: parsed.data.fileName,
  });

  return NextResponse.json({ attachment }, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachments = await Attachment.find({ complaintRef: id }).sort({ uploadedAt: -1 }).lean();

  return NextResponse.json({ attachments });
}
