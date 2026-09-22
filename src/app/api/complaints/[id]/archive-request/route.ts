import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { archiveRequestSchema } from "@/features/complaints/schemas/complaint.schema";
import { archiveEligibility, notifyHeadForArchiveRequest } from "@/lib/archive-workflow";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { canAccessInternalComplaintNotes } from "@/lib/complaint-access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "office_staff") return NextResponse.json({ error: "Only office staff can request archive approval." }, { status: 403 });
  await connectToDatabase();
  const { id } = await params;
  const parsed = archiveRequestSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (String(complaint.assignedOfficeRef ?? "") !== String(session.user.officeRef ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!complaint.assignedOfficeRef) return NextResponse.json({ error: "Complaint has no responsible office." }, { status: 400 });
  const isClaimedBySomeoneElse = complaint.assignedStaffRef && String(complaint.assignedStaffRef) !== session.user.id;
  if (isClaimedBySomeoneElse) return NextResponse.json({ error: "Only the staff member currently assigned to this complaint may request archive." }, { status: 403 });
  const eligibility = archiveEligibility(complaint.status);
  if (eligibility) return NextResponse.json({ error: eligibility }, { status: 400 });
  const duplicate = await ArchiveRequest.findOne({ complaintRef: id, status: "pending" }).lean();
  if (duplicate) return NextResponse.json({ error: "An archive request is already pending for this complaint." }, { status: 409 });
  const reasonText = parsed.data.reasonText || parsed.data.reason;
  const displayReason = parsed.data.reasonCode === "other" ? reasonText : `${parsed.data.reasonCode}: ${reasonText || parsed.data.reasonCode}`;
  const request = await ArchiveRequest.create({ complaintRef: id, requestedByRef: session.user.id, officeRef: complaint.assignedOfficeRef as any, reasonCode: parsed.data.reasonCode, reasonText, supportingNote: parsed.data.supportingNote, reason: displayReason, status: "pending" });
  await ComplaintTimeline.create({ complaintRef: id, eventType: "archive_requested", actorRef: session.user.id, message: displayReason });
  await writeAuditLog({ actorId: session.user.id, action: "complaint.archive_requested", entityType: "ArchiveRequest", entityId: request._id, afterState: { complaintRef: id, reasonCode: parsed.data.reasonCode, reasonText, status: "pending" } });
  await notifyHeadForArchiveRequest(id, String(request._id), displayReason);
  return NextResponse.json({ request }, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (!(await canAccessInternalComplaintNotes(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const requests = await ArchiveRequest.find({ complaintRef: id }).sort({ createdAt: -1 }).populate("requestedByRef", "firstName lastName role").populate("reviewedByRef", "firstName lastName role").lean();
  return NextResponse.json({ requests });
}
