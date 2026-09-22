import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { archiveDecisionSchema } from "@/features/complaints/schemas/complaint.schema";
import { archiveComplaint, getComplaintOfficeHead } from "@/lib/archive-workflow";
import { notifyArchiveDecision } from "@/features/notifications/services/notification.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const parsed = archiveDecisionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const request = await ArchiveRequest.findById(id);
  if (!request) return NextResponse.json({ error: "Archive request not found" }, { status: 404 });
  if (request.status !== "pending") return NextResponse.json({ error: "This archive request has already been decided." }, { status: 409 });
  const isAdmin = session.user.role === "administrator";
  const head = await getComplaintOfficeHead(request.officeRef);
  if (!isAdmin && String(head?.head._id ?? "") !== session.user.id) return NextResponse.json({ error: "Only the responsible office head can decide this request." }, { status: 403 });
  const complaint = await Complaint.findById(request.complaintRef).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (String(complaint.assignedOfficeRef ?? "") !== String(request.officeRef)) {
    return NextResponse.json({ error: "The complaint is no longer assigned to this office." }, { status: 409 });
  }
  if (parsed.data.action === "reject") {
    request.status = "rejected";
    request.reviewedByRef = session.user.id as any;
    request.reviewedAt = new Date();
    request.rejectionReason = parsed.data.rejectionReason ?? "";
    await request.save();
    await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "archive_rejected", actorRef: session.user.id, message: request.rejectionReason || "Archive request rejected" });
    await writeAuditLog({ actorId: session.user.id, action: "complaint.archive_rejected", entityType: "ArchiveRequest", entityId: request._id, afterState: { status: "rejected", rejectionReason: request.rejectionReason } });
    await notifyArchiveDecision({ userId: String(request.requestedByRef), approved: false, ticketNumber: complaint.ticketNumber, complaintId: String(complaint._id), reason: request.rejectionReason });
    return NextResponse.json({ request });
  }
  const result = await archiveComplaint({ complaintId: String(request.complaintRef), actorId: session.user.id, reason: request.reason, source: isAdmin ? "administrator_direct" : "staff_request_approved", requestId: String(request._id) });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "archive_approved", actorRef: session.user.id, message: request.reason });
  await notifyArchiveDecision({ userId: String(request.requestedByRef), approved: true, ticketNumber: complaint.ticketNumber, complaintId: String(complaint._id) });
  return NextResponse.json({ request: await ArchiveRequest.findById(id).lean(), complaint: result.complaint });
}
