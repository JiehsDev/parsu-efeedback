import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { InformationRequest } from "@/models/InformationRequest";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Attachment } from "@/models/Attachment";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { informationResponseSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyInformationSubmitted } from "@/features/notifications/services/notification.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "student")
    return NextResponse.json({ error: "Only the complaint owner can respond" }, { status: 403 });
  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (String(complaint.studentRef) !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (complaint.status !== "pending_information")
    return NextResponse.json(
      { error: "This complaint is not awaiting information." },
      { status: 400 },
    );

  const request = await InformationRequest.findOne({ complaintRef: id, status: "open" }).sort({
    requestedAt: -1,
  });
  if (!request)
    return NextResponse.json(
      { error: "No open information request exists for this complaint." },
      { status: 400 },
    );
  const body = await req.json();
  const parsed = informationResponseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const attachmentIds = parsed.data.attachmentIds;
  const attachments = attachmentIds.length
    ? await Attachment.find({
        _id: { $in: attachmentIds },
        complaintRef: id,
        uploadedByRef: session.user.id,
      })
        .select("_id")
        .lean()
    : [];
  if (attachments.length !== attachmentIds.length)
    return NextResponse.json(
      { error: "One or more attachments are invalid for this complaint." },
      { status: 400 },
    );

  request.status = "responded";
  request.respondedAt = new Date();
  request.responseMessage = parsed.data.responseMessage;
  request.responseAttachmentRefs = attachmentIds as any;
  await request.save();
  const fromStatus = complaint.status;
  complaint.status = "in_progress";
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "information_submitted",
    actorRef: session.user.id,
    message: parsed.data.responseMessage,
  });
  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "status_changed",
    actorRef: session.user.id,
    fromValue: fromStatus,
    toValue: "in_progress",
    message: "Student submitted the requested information",
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "COMPLAINT_INFORMATION_SUBMITTED",
    entityType: "InformationRequest",
    entityId: request._id,
    afterState: {
      complaintRef: id,
      responseMessage: parsed.data.responseMessage,
      attachmentCount: attachmentIds.length,
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.status_change",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: fromStatus },
    afterState: { status: "in_progress", reason: "Information submitted" },
  });

  const recipientIds: string[] = [];
  if (complaint.assignedStaffRef) recipientIds.push(String(complaint.assignedStaffRef));
  if (complaint.assignedOfficeRef) {
    const office = await Office.findById(complaint.assignedOfficeRef).select("headUserRef").lean();
    if ((office as any)?.headUserRef) recipientIds.push(String((office as any).headUserRef));
    if (recipientIds.length === 0) {
      const staff = await User.find({
        role: "office_staff",
        officeRef: complaint.assignedOfficeRef,
        isActive: true,
      })
        .select("_id")
        .lean();
      recipientIds.push(...staff.map((member: any) => String(member._id)));
    }
  }
  await notifyInformationSubmitted({
    staffIds: recipientIds,
    ticketNumber: complaint.ticketNumber,
    complaintId: id,
  });
  return NextResponse.json({ complaint, request });
}
