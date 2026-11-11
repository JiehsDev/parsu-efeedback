import mongoose from "mongoose";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Assignment } from "@/models/Assignment";
import { AuditLog } from "@/models/AuditLog";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Notification } from "@/models/Notification";
import { Office } from "@/models/Office";
import { OfficeReturnRequest } from "@/models/OfficeReturnRequest";
import { ResolutionRequest } from "@/models/ResolutionRequest";
import { User } from "@/models/User";
import {
  canManageOfficeAssignments,
  canProcessComplaint,
  isOsasHead,
  refId,
} from "@/lib/osas-operations";
import {
  notifyOfficeReturnDecision,
  notifyOfficeReturnRequested,
} from "@/features/notifications/services/notification.service";

const RECEIVING_STATUS = ["in_progress", "pending_information"];

export class OfficeReturnError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = "OfficeReturnError";
  }
}

function duplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function initializeModels() {
  await Promise.all([
    OfficeReturnRequest.init(),
    Assignment.init(),
    ComplaintTimeline.init(),
    AuditLog.init(),
    Notification.init(),
  ]);
}

export async function requestReturnToOsas(params: {
  session: any;
  complaintId: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { session } = params;
  if (!session?.user || !["vpaa", "vpaf"].includes(session.user.role))
    throw new OfficeReturnError("Only the assigned VPAA/VPAF handler or receiving-office Head may request a return to OSAS.", 403);

  const complaint = await Complaint.findById(params.complaintId);
  if (!complaint) throw new OfficeReturnError("Complaint not found.", 404);
  if (complaint.isArchived || !RECEIVING_STATUS.includes(complaint.status))
    throw new OfficeReturnError("Only active forwarded complaints can be returned to OSAS.", 409);
  if (
    complaint.forwardedToRole !== session.user.role ||
    !complaint.forwardedAt ||
    !complaint.assignedStaffRef
  )
    throw new OfficeReturnError("Only an active forwarded complaint can be returned to OSAS.", 403);

  const [sourceOffice, osas] = await Promise.all([
    Office.findById(complaint.assignedOfficeRef),
    Office.findOne({ code: "OSAS", isActive: true }),
  ]);
  const expectedSourceCode = session.user.role === "vpaa" ? "OVPAA" : "OVPAF";
  if (!sourceOffice || sourceOffice.code !== expectedSourceCode)
    throw new OfficeReturnError("The complaint is not assigned to its recorded receiving office.", 409);
  const receivingOfficeHead = await canManageOfficeAssignments(session, sourceOffice);
  if (!receivingOfficeHead && !(await canProcessComplaint(session, complaint)))
    throw new OfficeReturnError("Only the assigned handler or receiving-office Head may request a return.", 403);
  if (!osas) throw new OfficeReturnError("OSAS is unavailable. Contact an administrator.", 503);
  const osasHead = osas.headUserRef
    ? await User.findOne({ _id: osas.headUserRef, isActive: true }).select("_id").lean()
    : null;
  if (!osasHead)
    throw new OfficeReturnError("OSAS must have an active Office Head before a return can be requested.", 409);

  const [pendingReturn, pendingArchive, pendingResolution] = await Promise.all([
    OfficeReturnRequest.exists({ complaintRef: complaint._id, status: "pending" }),
    ArchiveRequest.exists({ complaintRef: complaint._id, status: "pending" }),
    ResolutionRequest.exists({ complaintRef: complaint._id, status: "pending" }),
  ]);
  if (pendingReturn) throw new OfficeReturnError("A return request is already pending for this complaint.", 409);
  if (pendingArchive || pendingResolution)
    throw new OfficeReturnError("Decide the pending complaint review request before requesting a return.", 409);

  await initializeModels();
  const now = new Date();
  const dbSession = await mongoose.startSession();
  let request: any;
  try {
    await dbSession.withTransaction(async () => {
      const freshComplaint = await Complaint.findById(complaint._id).session(dbSession);
      const freshSourceOffice = await Office.findById(sourceOffice._id).session(dbSession);
      const isCurrentOfficeHead = Boolean(
        freshSourceOffice?.isActive &&
        freshSourceOffice.code === expectedSourceCode &&
        refId(freshSourceOffice.headUserRef) === session.user.id &&
        session.user.role === (expectedSourceCode === "OVPAA" ? "vpaa" : "vpaf"),
      );
      if (
        !freshComplaint ||
        freshComplaint.isArchived ||
        freshComplaint.status !== complaint.status ||
        refId(freshComplaint.assignedOfficeRef) !== refId(sourceOffice._id) ||
        (!isCurrentOfficeHead && refId(freshComplaint.assignedStaffRef) !== session.user.id) ||
        freshComplaint.forwardedToRole !== session.user.role ||
        !freshComplaint.forwardedAt ||
        freshComplaint.forwardedAt.getTime() !== complaint.forwardedAt!.getTime()
      )
        throw new OfficeReturnError("The complaint changed while the return request was being prepared.", 409);
      if (!freshComplaint.assignedStaffRef || !freshComplaint.forwardedAt)
        throw new OfficeReturnError("The complaint no longer has an assigned receiving-office handler.", 409);

      const createdRequests = await OfficeReturnRequest.create(
        [
          {
            complaintRef: freshComplaint._id,
            requestedByUserRef: session.user.id,
            sourceOfficeRef: sourceOffice._id,
            destinationOfficeRef: osas._id,
            forwardedToRole: session.user.role,
            assignedStaffRef: freshComplaint.assignedStaffRef,
            complaintStatus: freshComplaint.status,
            forwardedAt: freshComplaint.forwardedAt,
            reason: params.reason,
            status: "pending",
            requestedAt: now,
          },
        ],
        { session: dbSession },
      );
      request = createdRequests[0];
      await ComplaintTimeline.create(
        [
          {
            complaintRef: freshComplaint._id,
            eventType: "office_return_requested",
            actorRef: session.user.id,
            fromValue: sourceOffice.code,
            toValue: "OSAS",
            message: params.reason,
          },
        ],
        { session: dbSession },
      );
      await AuditLog.create(
        [
          {
            actorRef: session.user.id,
            action: "complaint.office_return_requested",
            entityType: "OfficeReturnRequest",
            entityId: request._id,
            afterState: {
              complaintRef: freshComplaint._id,
              sourceOfficeRef: sourceOffice._id,
              destinationOfficeRef: osas._id,
              status: "pending",
              reason: params.reason,
            },
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
          },
        ],
        { session: dbSession },
      );
    });
  } catch (error) {
    if (duplicateKey(error))
      throw new OfficeReturnError("A return request is already pending for this complaint.", 409);
    throw error;
  } finally {
    await dbSession.endSession();
  }

  await notifyOfficeReturnRequested({
    userId: refId(osasHead._id),
    ticketNumber: complaint.ticketNumber,
    sourceOffice: sourceOffice.name,
    reason: params.reason,
  });
  return request;
}

export async function decideReturnToOsas(params: {
  session: any;
  requestId: string;
  action: "approve" | "reject";
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { session } = params;
  if (!session?.user || !(await isOsasHead(session)))
    throw new OfficeReturnError("Only the active OSAS Office Head may decide this request.", 403);

  await initializeModels();
  const dbSession = await mongoose.startSession();
  let outcome: any;
  try {
    await dbSession.withTransaction(async () => {
      const request = await OfficeReturnRequest.findOne({
        _id: params.requestId,
        status: "pending",
      }).session(dbSession);
      if (!request) throw new OfficeReturnError("Pending return request not found.", 404);

      const complaint = await Complaint.findById(request.complaintRef).session(dbSession);
      if (!complaint) throw new OfficeReturnError("Complaint not found.", 404);
      const osas = await Office.findOne({
        _id: request.destinationOfficeRef,
        code: "OSAS",
        isActive: true,
        headUserRef: session.user.id,
      }).session(dbSession);
      if (!osas) throw new OfficeReturnError("Only the active OSAS Office Head may decide this request.", 403);

      const snapshotMatches =
        !complaint.isArchived &&
        complaint.status === request.complaintStatus &&
        refId(complaint.assignedOfficeRef) === refId(request.sourceOfficeRef) &&
        refId(complaint.assignedStaffRef) === refId(request.assignedStaffRef) &&
        complaint.forwardedToRole === request.forwardedToRole &&
        complaint.forwardedAt?.getTime() === request.forwardedAt.getTime() &&
        RECEIVING_STATUS.includes(complaint.status);

      const now = new Date();
      request.reviewedByUserRef = session.user.id;
      request.reviewedAt = now;
      request.reviewReason = params.reason;

      if (params.action === "reject") {
        request.status = "rejected";
        await request.save({ session: dbSession });
        await ComplaintTimeline.create(
          [
            {
              complaintRef: complaint._id,
              eventType: "office_return_rejected",
              actorRef: session.user.id,
              fromValue: request.forwardedToRole.toUpperCase(),
              toValue: request.forwardedToRole.toUpperCase(),
              message: params.reason,
            },
          ],
          { session: dbSession },
        );
        outcome = { request: request.toObject(), complaint, approved: false };
        return;
      }

      if (!snapshotMatches)
        throw new OfficeReturnError("The complaint status or assignment changed. This request cannot be approved.", 409);
      const [pendingArchive, pendingResolution] = await Promise.all([
        ArchiveRequest.exists({ complaintRef: complaint._id, status: "pending" }).session(dbSession),
        ResolutionRequest.exists({ complaintRef: complaint._id, status: "pending" }).session(dbSession),
      ]);
      if (pendingArchive || pendingResolution)
        throw new OfficeReturnError("Decide the other pending complaint review request before approving this return.", 409);

      const beforeState = {
        assignedOfficeRef: complaint.assignedOfficeRef,
        assignedStaffRef: complaint.assignedStaffRef,
        forwardedToRole: complaint.forwardedToRole,
        forwardedAt: complaint.forwardedAt,
        status: complaint.status,
      };
      const sourceOffice = await Office.findById(request.sourceOfficeRef).session(dbSession);
      if (!sourceOffice || sourceOffice.code !== (request.forwardedToRole === "vpaa" ? "OVPAA" : "OVPAF"))
        throw new OfficeReturnError("The receiving office is unavailable or does not match this request.", 409);

      complaint.initialOfficeRef ??= osas._id;
      complaint.assignedOfficeRef = osas._id;
      complaint.assignedStaffRef = null;
      complaint.forwardedToRole = null;
      complaint.forwardedAt = null;
      complaint.supervisorReviewRequired = false;
      // Keep the current active status and SLA timestamps; only ownership changes.
      await complaint.save({ session: dbSession });

      request.status = "approved";
      await request.save({ session: dbSession });
      await Assignment.create(
        [
          {
            complaintRef: complaint._id,
            assignedByRef: session.user.id,
            assignedToRef: null,
            sourceOfficeRef: sourceOffice._id,
            destinationOfficeRef: osas._id,
            reason: request.reason,
            actionType: "return_to_osas",
          },
        ],
        { session: dbSession },
      );
      await ComplaintTimeline.create(
        [
          {
            complaintRef: complaint._id,
            eventType: "complaint_returned_to_osas",
            actorRef: session.user.id,
            fromValue: sourceOffice.code,
            toValue: "OSAS",
            message: params.reason || request.reason,
          },
        ],
        { session: dbSession },
      );
      await AuditLog.create(
        [
          {
            actorRef: session.user.id,
            action: "complaint.office_return_approved",
            entityType: "OfficeReturnRequest",
            entityId: request._id,
            beforeState,
            afterState: {
              assignedOfficeRef: osas._id,
              assignedStaffRef: null,
              forwardedToRole: null,
              status: complaint.status,
              returnRequestRef: request._id,
              requestReason: request.reason,
              decisionReason: params.reason,
            },
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
          },
        ],
        { session: dbSession },
      );
      outcome = { request: request.toObject(), complaint, approved: true };
    });
  } finally {
    await dbSession.endSession();
  }

  await notifyOfficeReturnDecision({
    userId: refId(outcome.request.requestedByUserRef),
    ticketNumber: outcome.complaint.ticketNumber,
    approved: outcome.approved,
    reason: params.reason,
  });
  return outcome;
}
