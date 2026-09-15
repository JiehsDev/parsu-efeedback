import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { InformationRequest } from "@/models/InformationRequest";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { informationRequestSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { isComplaintInAdminScope, getAdminScope } from "@/lib/admin-scope";
import { notifyInformationRequested } from "@/features/notifications/services/notification.service";
import { isComplaintInOsasActionScope } from "@/lib/osas-complaint-scope";

async function canRequestInformation(session: any, complaint: any) {
  const { role, id, officeRef } = session.user;
  if (role === "administrator") return true;
  if (role === "office_staff") {
    return (
      String(complaint.assignedOfficeRef) === officeRef &&
      String(complaint.assignedStaffRef ?? "") === id
    );
  }
  if (role === "osas") return isComplaintInOsasActionScope(complaint);
  if (role === "vpaa" || role === "vpaf") {
    return isComplaintInAdminScope(getAdminScope(role), complaint);
  }
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (!(await canRequestInformation(session, complaint)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (complaint.status !== "in_progress") {
    return NextResponse.json(
      { error: "Additional information can only be requested from an in-progress complaint." },
      { status: 400 },
    );
  }
  if (await InformationRequest.exists({ complaintRef: id, status: "open" })) {
    return NextResponse.json(
      { error: "This complaint already has an open information request." },
      { status: 409 },
    );
  }

  const body = await req.json();
  const parsed = informationRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await InformationRequest.create({
    complaintRef: id,
    requestedByRef: session.user.id,
    requestMessage: parsed.data.requestMessage,
    context: parsed.data.context,
    status: "open",
  });
  const fromStatus = complaint.status;
  complaint.status = "pending_information";
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "information_requested",
    actorRef: session.user.id,
    message: parsed.data.requestMessage,
  });
  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "status_changed",
    actorRef: session.user.id,
    fromValue: fromStatus,
    toValue: "pending_information",
    message: "Awaiting information from student",
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "COMPLAINT_INFORMATION_REQUESTED",
    entityType: "InformationRequest",
    entityId: request._id,
    afterState: {
      complaintRef: id,
      requestMessage: parsed.data.requestMessage,
      context: parsed.data.context,
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.status_change",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: fromStatus },
    afterState: { status: "pending_information", reason: "Information requested" },
  });
  await notifyInformationRequested({
    studentId: String(complaint.studentRef),
    ticketNumber: complaint.ticketNumber,
    complaintId: id,
    requestMessage: parsed.data.requestMessage,
  });

  return NextResponse.json({ complaint, request }, { status: 201 });
}
