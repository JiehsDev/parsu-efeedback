import mongoose, { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isOfficeHead } from "@/lib/office-head";
import { canAccessInternalComplaintNotes } from "@/lib/complaint-access";
import { dismissalDecisionSchema } from "@/features/complaints/schemas/dismissal.schema";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { DismissalRequest } from "@/models/DismissalRequest";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import {
  notifyDismissalDecision,
  notifyComplaintDismissed,
} from "@/features/notifications/services/notification.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["office_staff", "osas", "vpaa", "vpaf"].includes(session.user.role))
    return NextResponse.json(
      { error: "Only the responsible office head may decide this request." },
      { status: 403 },
    );
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  const parsed = dismissalDecisionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  await connectToDatabase();
  const request = await DismissalRequest.findById(id).lean();
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (!(await isOfficeHead(session.user.id, request.officeRef)))
    return NextResponse.json(
      { error: "Only the responsible office head may decide this request." },
      { status: 403 },
    );
  if (String(request.requestedByRef) === session.user.id)
    return NextResponse.json(
      { error: "A requester cannot approve their own dismissal request." },
      { status: 403 },
    );

  const dbSession = await mongoose.startSession();
  let result:
    | { status: number; error: string }
    | {
        complaintId: string;
        studentId: string;
        staffId: string;
        ticketNumber: string;
        approved: boolean;
        reason: string;
      } = { status: 409, error: "The request could not be decided." };
  try {
    await dbSession.withTransaction(async () => {
      const current = await DismissalRequest.findOne({ _id: id, status: "pending" }).session(
        dbSession,
      );
      if (!current) {
        result = { status: 409, error: "This dismissal request has already been decided." };
        return;
      }
      const complaint = await Complaint.findById(current.complaintRef).session(dbSession);
      if (!complaint) {
        result = { status: 404, error: "Complaint not found" };
        return;
      }
      if (!(await canAccessInternalComplaintNotes(session, complaint))) {
        result = { status: 403, error: "Forbidden" };
        return;
      }
      if (
        complaint.isArchived ||
        String(complaint.assignedOfficeRef) !== String(current.officeRef) ||
        String(complaint.assignedStaffRef) !== String(current.assignedStaffRef) ||
        complaint.status !== current.complaintStatus ||
        !["assigned", "in_progress"].includes(complaint.status)
      ) {
        result = {
          status: 409,
          error: "The complaint status or assignment changed. This request cannot be decided.",
        };
        return;
      }
      const now = new Date();
      current.status = parsed.data.action === "approve" ? "approved" : "rejected";
      current.reviewedByRef = new Types.ObjectId(session.user.id);
      current.reviewedAt = now;
      current.rejectionReason = parsed.data.action === "reject" ? parsed.data.rejectionReason : "";
      await current.save({ session: dbSession });
      if (parsed.data.action === "approve") {
        const fromStatus = complaint.status;
        complaint.status = "dismissed";
        complaint.dismissedAt = now;
        complaint.dismissedByRef = new Types.ObjectId(session.user.id);
        complaint.dismissalReasonCode = current.reasonCode;
        complaint.dismissalReason = current.reasonText;
        await complaint.save({ session: dbSession });
        await ComplaintTimeline.create(
          [
            {
              complaintRef: complaint._id,
              eventType: "dismissed",
              actorRef: session.user.id,
              fromValue: fromStatus,
              toValue: "dismissed",
              message: current.reasonText,
            },
          ],
          { session: dbSession },
        );
      } else {
        await ComplaintTimeline.create(
          [
            {
              complaintRef: complaint._id,
              eventType: "dismissal_rejected",
              actorRef: session.user.id,
              fromValue: complaint.status,
              toValue: complaint.status,
              message: current.rejectionReason,
            },
          ],
          { session: dbSession },
        );
      }
      result = {
        complaintId: String(complaint._id),
        studentId: String(complaint.studentRef),
        staffId: String(current.requestedByRef),
        ticketNumber: complaint.ticketNumber,
        approved: parsed.data.action === "approve",
        reason: parsed.data.action === "approve" ? current.reasonText : current.rejectionReason,
      };
    });
  } finally {
    await dbSession.endSession();
  }
  const decision = result as
    | { status: number; error: string }
    | {
        complaintId: string;
        studentId: string;
        staffId: string;
        ticketNumber: string;
        approved: boolean;
        reason: string;
      };
  if ("error" in decision)
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  await writeAuditLog({
    actorId: session.user.id,
    action: decision.approved ? "complaint.dismissal_approved" : "complaint.dismissal_rejected",
    entityType: "DismissalRequest",
    entityId: id,
    afterState: {
      complaintRef: decision.complaintId,
      status: decision.approved ? "approved" : "rejected",
    },
  });
  await notifyDismissalDecision({
    userId: decision.staffId,
    ticketNumber: decision.ticketNumber,
    complaintId: decision.complaintId,
    approved: decision.approved,
    reason: decision.reason,
  });
  if (decision.approved)
    await notifyComplaintDismissed({
      studentId: decision.studentId,
      ticketNumber: decision.ticketNumber,
      complaintId: decision.complaintId,
      reason: decision.reason,
    });
  return NextResponse.json({
    request: await DismissalRequest.findById(id).lean(),
    complaint: await Complaint.findById(decision.complaintId).lean(),
  });
}
