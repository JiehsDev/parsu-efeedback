import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { resolutionDecisionSchema } from "@/features/complaints/schemas/complaint.schema";
import { isOfficeHead } from "@/lib/office-head";
import { canAccessInternalComplaintNotes } from "@/lib/complaint-access";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import {
  notifyComplaintResolved,
  notifyResolutionDecision,
} from "@/features/notifications/services/notification.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const parsed = resolutionDecisionSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await ResolutionRequest.findById(id).lean();
  if (!request) return NextResponse.json({ error: "Resolution request not found" }, { status: 404 });
  if (!(await isOfficeHead(session.user.id, request.officeRef)))
    return NextResponse.json({ error: "Only the responsible office head may decide this request." }, { status: 403 });

  const dbSession = await mongoose.startSession();
  let outcome: any = {
      error: "The request could not be reviewed.",
      status: 409,
    };
  try {
    await dbSession.withTransaction(async () => {
      const current = await ResolutionRequest.findOne({ _id: id, status: "pending" }).session(dbSession);
      if (!current) {
        outcome = { error: "This resolution request has already been decided.", status: 409 };
        return;
      }
      const complaint = await Complaint.findById(current.complaintRef).session(dbSession);
      if (!complaint) {
        outcome = { error: "Complaint not found", status: 404 };
        return;
      }
      if (!(await canAccessInternalComplaintNotes(session, complaint))) {
        outcome = { error: "Forbidden", status: 403 };
        return;
      }
      if (
        complaint.isArchived ||
        String(complaint.assignedOfficeRef) !== String(current.officeRef) ||
        String(complaint.assignedStaffRef ?? "") !== String(current.assignedStaffRef) ||
        complaint.status !== current.complaintStatus
      ) {
        outcome = {
          error: "The complaint's status or assignment changed. This request can no longer be approved.",
          status: 409,
        };
        return;
      }

      const now = new Date();
      current.reviewedByRef = session.user.id as any;
      current.reviewedAt = now;
      if (parsed.data.action === "reject") {
        current.status = "rejected";
        current.rejectionReason = parsed.data.rejectionReason;
        await current.save({ session: dbSession });
        await ComplaintTimeline.create(
          [{
            complaintRef: complaint._id,
            eventType: "resolution_rejected",
            actorRef: session.user.id,
            fromValue: current.complaintStatus,
            toValue: current.complaintStatus,
            message: parsed.data.rejectionReason,
          }],
          { session: dbSession },
        );
      } else {
        current.status = "approved";
        complaint.status = "resolved";
        complaint.resolutionSummary = current.resolutionSummary;
        complaint.resolvedAt = now;
        // Keep the staff member who performed the work as the resolver; the approval event records the head.
        complaint.resolvedByRef = current.requestedByRef as any;
        await complaint.save({ session: dbSession });
        await current.save({ session: dbSession });
        await ComplaintTimeline.create(
          [{
            complaintRef: complaint._id,
            eventType: "resolved",
            actorRef: session.user.id,
            fromValue: current.complaintStatus,
            toValue: "resolved",
            message: current.message,
            resolutionSummary: current.resolutionSummary,
          }],
          { session: dbSession },
        );
      }
      outcome = {
        complaint: complaint.toObject(),
        decisionRequest: current.toObject(),
        approved: parsed.data.action === "approve",
      };
    });
  } finally {
    await dbSession.endSession();
  }

  if ("error" in outcome)
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  const savedComplaint = await Complaint.findById(outcome.complaint._id).lean();
  if (!savedComplaint || (outcome.approved && savedComplaint.status !== "resolved"))
    return NextResponse.json(
      { error: "The resolution decision did not persist. The request remains available for review." },
      { status: 500 },
    );
  outcome.complaint = savedComplaint;

  await writeAuditLog({
    actorId: session.user.id,
    action: outcome.approved ? "complaint.resolution_approved" : "complaint.resolution_rejected",
    entityType: "ResolutionRequest",
    entityId: outcome.decisionRequest._id,
    afterState: {
      status: outcome.decisionRequest.status,
      complaintRef: String(outcome.complaint._id),
      ...(outcome.approved ? {} : { rejectionReason: parsed.data.rejectionReason }),
    },
  });
  await notifyResolutionDecision({
    userId: String(outcome.decisionRequest.requestedByRef),
    approved: outcome.approved,
    ticketNumber: outcome.complaint.ticketNumber,
    complaintId: String(outcome.complaint._id),
    reason: parsed.data.rejectionReason,
  });
  if (outcome.approved) {
    await notifyComplaintResolved({
      studentId: String(outcome.complaint.studentRef),
      ticketNumber: outcome.complaint.ticketNumber,
      complaintId: String(outcome.complaint._id),
    });
  }
  return NextResponse.json({ request: outcome.decisionRequest, complaint: outcome.complaint });
}
