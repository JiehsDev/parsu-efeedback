// src/app/api/complaints/[id]/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { Attachment } from "@/models/Attachment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { createAttachmentSchema } from "@/features/attachments/schemas/attachment.schema";

async function canAccessComplaint(session: any, complaint: any): Promise<boolean> {
  const { role, id, officeRef, collegeRef } = session.user;
  if (role === "administrator" || role === "qa_office") return true;
  if (role === "student") return String(complaint.studentRef) === id;
  if (role === "office_staff") return String(complaint.assignedOfficeRef) === officeRef;
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
