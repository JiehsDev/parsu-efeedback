import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canProcessComplaint } from "@/lib/osas-operations";
import { canAccessInternalComplaintNotes } from "@/lib/complaint-access";
import { isOfficeHead } from "@/lib/office-head";
import { dismissalRequestSchema } from "@/features/complaints/schemas/dismissal.schema";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { DismissalRequest } from "@/models/DismissalRequest";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { OfficeReturnRequest } from "@/models/OfficeReturnRequest";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Office } from "@/models/Office";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyDismissalRequested } from "@/features/notifications/services/notification.service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectToDatabase();
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessInternalComplaintNotes(session, complaint)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requests = await DismissalRequest.find({ complaintRef: id })
    .sort({ createdAt: -1 })
    .populate("requestedByRef reviewedByRef", "firstName lastName role")
    .lean();
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["office_staff", "osas", "vpaa", "vpaf"].includes(session.user.role))
    return NextResponse.json(
      { error: "Only assigned office handlers may request dismissal." },
      { status: 403 },
    );
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  const parsed = dismissalRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  await connectToDatabase();
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (complaint.isArchived || !["assigned", "in_progress"].includes(complaint.status))
    return NextResponse.json(
      { error: "Only active assigned complaints can be dismissed." },
      { status: 409 },
    );
  if (
    !complaint.assignedOfficeRef ||
    !complaint.assignedStaffRef ||
    !(await canProcessComplaint(session, complaint))
  )
    return NextResponse.json(
      { error: "Only the assigned handler may request dismissal." },
      { status: 403 },
    );
  const assignedOfficeRef = complaint.assignedOfficeRef;
  const assignedStaffRef = complaint.assignedStaffRef;
  if (await isOfficeHead(session.user.id, complaint.assignedOfficeRef))
    return NextResponse.json(
      { error: "The responsible office head can dismiss directly with a reason." },
      { status: 403 },
    );
  const office = await Office.findOne({ _id: assignedOfficeRef, isActive: true }).lean();
  if (!office?.headUserRef)
    return NextResponse.json(
      { error: "The responsible office has no active head to review this request." },
      { status: 409 },
    );
  const conflict = await Promise.all([
    DismissalRequest.exists({ complaintRef: id, status: "pending" }),
    ResolutionRequest.exists({ complaintRef: id, status: "pending" }),
    ForwardingRequest.exists({ complaintRef: id, status: "pending" }),
    OfficeReturnRequest.exists({ complaintRef: id, status: "pending" }),
    ArchiveRequest.exists({ complaintRef: id, status: "pending" }),
  ]);
  if (conflict.some(Boolean))
    return NextResponse.json(
      { error: "Decide the existing complaint review request first." },
      { status: 409 },
    );
  let request: { _id: Types.ObjectId };
  try {
    request = await DismissalRequest.create({
      complaintRef: complaint._id,
      requestedByRef: session.user.id,
      officeRef: assignedOfficeRef,
      assignedStaffRef,
      complaintStatus: complaint.status,
      ...parsed.data,
    });
  } catch (error: any) {
    if (error?.code === 11000)
      return NextResponse.json(
        { error: "A dismissal request is already pending." },
        { status: 409 },
      );
    throw error;
  }
  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "dismissal_requested",
    actorRef: session.user.id,
    fromValue: complaint.status,
    toValue: complaint.status,
    message: parsed.data.reasonText,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.dismissal_requested",
    entityType: "DismissalRequest",
    entityId: request._id,
    afterState: { complaintRef: id, reasonCode: parsed.data.reasonCode, status: "pending" },
  });
  await notifyDismissalRequested({
    userId: String(office.headUserRef),
    ticketNumber: complaint.ticketNumber,
    complaintId: id,
  });
  return NextResponse.json({ request }, { status: 201 });
}
