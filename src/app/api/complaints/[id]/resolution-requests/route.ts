import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { resolutionRequestSchema } from "@/features/complaints/schemas/complaint.schema";
import { canProcessComplaint, refId } from "@/lib/osas-operations";
import { canAccessInternalComplaintNotes } from "@/lib/complaint-access";
import { isValidTransition } from "@/features/complaints/services/status-transitions.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyResolutionRequest } from "@/features/notifications/services/notification.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (!(await canAccessInternalComplaintNotes(session, complaint)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requests = await ResolutionRequest.find({ complaintRef: id })
    .sort({ createdAt: -1 })
    .populate("requestedByRef reviewedByRef", "firstName lastName role")
    .lean();
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["office_staff", "osas", "vpaa", "vpaf"].includes(session.user.role))
    return NextResponse.json({ error: "Only assigned office staff may request resolution approval." }, { status: 403 });
  await connectToDatabase();
  const { id } = await params;
  const parsed = resolutionRequestSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid resolution request.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );

  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (complaint.isArchived)
    return NextResponse.json({ error: "Archived complaints cannot be resolved." }, { status: 403 });
  if (!(await canProcessComplaint(session, complaint)))
    return NextResponse.json({ error: "Only the assigned handler may request resolution approval." }, { status: 403 });
  if (!complaint.assignedOfficeRef || !complaint.assignedStaffRef)
    return NextResponse.json({ error: "Assign this complaint to an office handler before requesting resolution." }, { status: 400 });
  if (!isValidTransition(complaint.status, "resolved"))
    return NextResponse.json({ error: "This complaint is not ready for a resolution request." }, { status: 400 });

  const office = await Office.findById(complaint.assignedOfficeRef).select("headUserRef").lean();
  if (!office?.headUserRef)
    return NextResponse.json({ error: "This office has no designated head to review the request." }, { status: 409 });
  if (await ResolutionRequest.exists({ complaintRef: id, status: "pending" }))
    return NextResponse.json({ error: "A resolution request is already awaiting head approval." }, { status: 409 });

  let request: any;
  try {
    request = await ResolutionRequest.create({
      complaintRef: complaint._id,
      requestedByRef: session.user.id,
      officeRef: complaint.assignedOfficeRef,
      assignedStaffRef: complaint.assignedStaffRef,
      complaintStatus: complaint.status,
      resolutionSummary: parsed.data.resolutionSummary,
      message: parsed.data.message,
      status: "pending",
    });
  } catch (error: any) {
    if (error?.code === 11000)
      return NextResponse.json({ error: "A resolution request is already awaiting head approval." }, { status: 409 });
    throw error;
  }

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "resolution_requested",
    actorRef: session.user.id,
    fromValue: complaint.status,
    toValue: "resolved",
    message: parsed.data.message,
    resolutionSummary: parsed.data.resolutionSummary,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.resolution_requested",
    entityType: "ResolutionRequest",
    entityId: request._id,
    afterState: { complaintRef: id, status: "pending", resolutionSummary: parsed.data.resolutionSummary },
  });
  await notifyResolutionRequest({
    userId: refId(office.headUserRef),
    ticketNumber: complaint.ticketNumber,
    complaintId: id,
  });
  return NextResponse.json({ request }, { status: 201 });
}
