import mongoose, { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isOfficeHead } from "@/lib/office-head";
import { dismissalRequestSchema } from "@/features/complaints/schemas/dismissal.schema";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { DismissalRequest } from "@/models/DismissalRequest";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { OfficeReturnRequest } from "@/models/OfficeReturnRequest";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyComplaintDismissed } from "@/features/notifications/services/notification.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["office_staff", "osas", "vpaa", "vpaf"].includes(session.user.role))
    return NextResponse.json(
      { error: "Only the responsible office head may dismiss directly." },
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
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (!(await isOfficeHead(session.user.id, complaint.assignedOfficeRef)))
    return NextResponse.json(
      { error: "Only the responsible office head may dismiss directly." },
      { status: 403 },
    );
  const reviewedOfficeId = String(complaint.assignedOfficeRef);
  const dbSession = await mongoose.startSession();
  let outcome: { status: number; error: string } | { studentId: string; ticketNumber: string } = {
    status: 409,
    error: "Could not dismiss this complaint.",
  };
  try {
    await dbSession.withTransaction(async () => {
      const current = await Complaint.findById(id).session(dbSession);
      if (
        !current ||
        current.isArchived ||
        String(current.assignedOfficeRef) !== reviewedOfficeId ||
        !["assigned", "in_progress"].includes(current.status)
      ) {
        outcome = { status: 409, error: "Only active assigned complaints can be dismissed." };
        return;
      }
      const pending = await Promise.all([
        DismissalRequest.exists({ complaintRef: id, status: "pending" }).session(dbSession),
        ResolutionRequest.exists({ complaintRef: id, status: "pending" }).session(dbSession),
        ForwardingRequest.exists({ complaintRef: id, status: "pending" }).session(dbSession),
        OfficeReturnRequest.exists({ complaintRef: id, status: "pending" }).session(dbSession),
        ArchiveRequest.exists({ complaintRef: id, status: "pending" }).session(dbSession),
      ]);
      if (pending.some(Boolean)) {
        outcome = { status: 409, error: "Decide the existing complaint review request first." };
        return;
      }
      const fromStatus = current.status;
      current.status = "dismissed";
      current.dismissedAt = new Date();
      current.dismissedByRef = new Types.ObjectId(session.user.id);
      current.dismissalReasonCode = parsed.data.reasonCode;
      current.dismissalReason = parsed.data.reasonText;
      await current.save({ session: dbSession });
      await ComplaintTimeline.create(
        [
          {
            complaintRef: current._id,
            eventType: "dismissed",
            actorRef: session.user.id,
            fromValue: fromStatus,
            toValue: "dismissed",
            message: parsed.data.reasonText,
          },
        ],
        { session: dbSession },
      );
      outcome = { studentId: String(current.studentRef), ticketNumber: current.ticketNumber };
    });
  } finally {
    await dbSession.endSession();
  }
  const finalOutcome = outcome as
    { status: number; error: string } | { studentId: string; ticketNumber: string };
  if ("error" in finalOutcome)
    return NextResponse.json({ error: finalOutcome.error }, { status: finalOutcome.status });
  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.dismissed_by_head",
    entityType: "Complaint",
    entityId: id,
    afterState: { status: "dismissed", reasonCode: parsed.data.reasonCode },
  });
  await notifyComplaintDismissed({
    studentId: finalOutcome.studentId,
    ticketNumber: finalOutcome.ticketNumber,
    complaintId: id,
    reason: parsed.data.reasonText,
  });
  return NextResponse.json({ complaint: await Complaint.findById(id).lean() });
}
