import mongoose from "mongoose";
import { z } from "zod";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { AuditLog } from "@/models/AuditLog";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Notification } from "@/models/Notification";
import { canProcessComplaint, isOsasHead, refId } from "@/lib/osas-operations";

export const requestSchema = z
  .object({
    destination: z.enum(["vpaa", "vpaf"]),
    reason: z.string().trim().min(1).max(4000),
    direct: z.boolean().optional(),
  })
  .strict();
export const decisionSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(4000).default(""),
  })
  .strict();
export class ForwardingError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const active = ["submitted", "assigned", "in_progress", "pending_information", "escalated"];

export async function forwardingHistoryFilter(session: any) {
  if (session.user.role === "administrator" || (await isOsasHead(session))) return {};
  if (session.user.role === "office_staff" || session.user.role === "osas")
    return { requestedByUserRef: session.user.id };
  // Receiving-office history is provided only through an authorized complaint view.
  throw new ForwardingError("Forbidden", 403);
}

/** Ownership, request decision, assignment, timeline, and audit commit together. */
export async function changeForwarding(
  session: any,
  input: { complaintId?: string; requestId?: string; body: any },
) {
  const creating = Boolean(input.complaintId);
  const parsed = creating
    ? requestSchema.safeParse(input.body)
    : decisionSchema.safeParse(input.body);
  if (!parsed.success)
    throw new ForwardingError(parsed.error.issues[0]?.message ?? "Invalid forwarding request", 400);
  if (!["osas", "office_staff"].includes(session.user.role))
    throw new ForwardingError("Only OSAS may request or perform forwarding.", 403);
  await Promise.all([
    ForwardingRequest.init(),
    Assignment.init(),
    ComplaintTimeline.init(),
    AuditLog.init(),
    Notification.init(),
  ]);
  const dbSession = await mongoose.startSession();
  let result: any;
  try {
    await dbSession.withTransaction(async () => {
      const data: any = parsed.data;
      let request: any = creating
        ? null
        : await ForwardingRequest.findById(input.requestId).session(dbSession);
      if (!creating && !request) throw new ForwardingError("Not found", 404);
      const complaint = await Complaint.findById(
        creating ? input.complaintId : request.complaintRef,
      ).session(dbSession);
      if (!complaint) throw new ForwardingError("Not found", 404);
      const osas = await Office.findOne({ code: "OSAS", isActive: true }).session(dbSession);
      const head = Boolean(osas && refId(osas.headUserRef) === session.user.id);
      if (!osas || refId(complaint.assignedOfficeRef) !== refId(osas._id))
        throw new ForwardingError("Complaint is no longer under OSAS.", 403);
      if (
        (creating || data.action === "approve") &&
        (complaint.isArchived || !active.includes(complaint.status))
      )
        throw new ForwardingError("Forwarding requires an active complaint.");
      if (creating) {
        if ((!head && !(await canProcessComplaint(session, complaint))) || (data.direct && !head))
          throw new ForwardingError(
            "Only the assigned OSAS handler may request forwarding; only the OSAS Head may forward.",
            403,
          );
        if (
          await ArchiveRequest.exists({ complaintRef: complaint._id, status: "pending" }).session(
            dbSession,
          )
        )
          throw new ForwardingError("Decide the pending archive request before forwarding.");
        const destination = await Office.findOne({
          code: data.destination === "vpaa" ? "OVPAA" : "OVPAF",
          isActive: true,
        }).session(dbSession);
        if (!destination)
          throw new ForwardingError("The receiving office must be configured and active.");
        [request] = await ForwardingRequest.create(
          [
            {
              complaintRef: complaint._id,
              fromOfficeRef: osas._id,
              destinationOfficeRef: destination._id,
              requestedDestination: data.destination,
              requestedByUserRef: session.user.id,
              reason: data.reason,
            },
          ],
          { session: dbSession },
        );
        await ComplaintTimeline.create(
          [
            {
              complaintRef: complaint._id,
              eventType: "forwarding_requested",
              actorRef: session.user.id,
              fromValue: "OSAS",
              toValue: data.destination.toUpperCase(),
              message: data.reason,
            },
          ],
          { session: dbSession },
        );
        await AuditLog.create(
          [
            {
              actorRef: session.user.id,
              action: "forwarding.requested",
              entityType: "ForwardingRequest",
              entityId: request._id,
              afterState: {
                complaintRef: complaint._id,
                fromOfficeRef: osas._id,
                destinationOfficeRef: destination._id,
                reason: data.reason,
              },
            },
          ],
          { session: dbSession },
        );
      }
      const decision = creating ? (data.direct ? "approve" : null) : data.action;
      if (decision) {
        if (!head)
          throw new ForwardingError(
            "Only the OSAS Office Head may decide forwarding requests.",
            403,
          );
        if (request.status !== "pending")
          throw new ForwardingError("This forwarding request has already been decided.");
        if (decision === "reject" && !data.reason)
          throw new ForwardingError("A rejection reason is required.", 400);
        request.status = decision === "approve" ? "approved" : "rejected";
        request.reviewedByUserRef = session.user.id;
        request.reviewedAt = new Date();
        request.reviewReason = data.reason ?? "";
        await request.save({ session: dbSession });
        if (decision === "approve") {
          if (
            await ArchiveRequest.exists({ complaintRef: complaint._id, status: "pending" }).session(
              dbSession,
            )
          )
            throw new ForwardingError("Decide the pending archive request before forwarding.");
          const destination = await Office.findOne({
            _id: request.destinationOfficeRef,
            code: request.requestedDestination === "vpaa" ? "OVPAA" : "OVPAF",
            isActive: true,
          }).session(dbSession);
          if (!destination)
            throw new ForwardingError("The receiving office is inactive or unavailable.");
          const candidates = await User.find({ role: request.requestedDestination, isActive: true })
            .select("_id")
            .session(dbSession);
          const receiver =
            candidates.find((user) => refId(user._id) === refId(destination.headUserRef)) ??
            (candidates.length === 1 ? candidates[0] : null);
          if (!receiver)
            throw new ForwardingError(
              "Configure a receiving office head or exactly one active receiving account.",
            );
          const previousStaff = complaint.assignedStaffRef;
          complaint.initialOfficeRef ??= osas._id;
          complaint.assignedOfficeRef = destination._id;
          // Existing VPAA/VPAF accounts are the receiving handlers; no duplicate staff accounts.
          complaint.assignedStaffRef = receiver._id;
          complaint.forwardedToRole = request.requestedDestination;
          complaint.forwardedAt = request.reviewedAt;
          complaint.status =
            complaint.status === "pending_information" ? "pending_information" : "in_progress";
          complaint.supervisorReviewRequired = false;
          await Assignment.create(
            [
              {
                complaintRef: complaint._id,
                assignedByRef: session.user.id,
                assignedToRef: receiver._id,
                sourceOfficeRef: osas._id,
                destinationOfficeRef: destination._id,
                actionType: "forward",
                reason: request.reason,
              },
            ],
            { session: dbSession },
          );
          await ComplaintTimeline.create(
            [
              {
                complaintRef: complaint._id,
                eventType: "complaint_forwarded",
                actorRef: session.user.id,
                fromValue: "OSAS",
                toValue: request.requestedDestination.toUpperCase(),
                message: request.reason,
              },
            ],
            { session: dbSession },
          );
          await AuditLog.create(
            [
              {
                actorRef: session.user.id,
                action: "complaint.forwarded",
                entityType: "Complaint",
                entityId: complaint._id,
                beforeState: { assignedOfficeRef: osas._id, assignedStaffRef: previousStaff },
                afterState: {
                  assignedOfficeRef: destination._id,
                  assignedStaffRef: receiver._id,
                  forwardingRequestRef: request._id,
                  reason: request.reason,
                },
              },
            ],
            { session: dbSession },
          );
        }
        await ComplaintTimeline.create(
          [
            {
              complaintRef: complaint._id,
              eventType: decision === "approve" ? "forwarding_approved" : "forwarding_rejected",
              actorRef: session.user.id,
              fromValue: "pending",
              toValue: request.status,
              message: request.reviewReason,
            },
          ],
          { session: dbSession },
        );
        await AuditLog.create(
          [
            {
              actorRef: session.user.id,
              action: `forwarding.${request.status}`,
              entityType: "ForwardingRequest",
              entityId: request._id,
              afterState: {
                status: request.status,
                reviewer: session.user.id,
                reason: request.reviewReason,
              },
            },
          ],
          { session: dbSession },
        );
      }
      // Serialize forwarding against concurrent decisions and persist ownership without touching SLA dates.
      complaint.increment();
      await complaint.save({ session: dbSession });
      const notifications: any[] = [];
      if (!decision)
        notifications.push({
          userRef: osas.headUserRef,
          type: "forwarding_request",
          title: "Forwarding request",
          body: `A handler requested forwarding to ${request.requestedDestination.toUpperCase()}.`,
          relatedComplaintRef: complaint._id,
        });
      else {
        // The requester retains their own request record, not access to the forwarded complaint.
        notifications.push({
          userRef: request.requestedByUserRef,
          type: "forwarding_decision",
          title: `Forwarding ${request.status}`,
          body: `Your request to ${request.requestedDestination.toUpperCase()} was ${request.status}.${request.reviewReason ? ` ${request.reviewReason}` : ""}`,
          relatedComplaintRef: null,
        });
        if (decision === "approve") {
          if (
            await ArchiveRequest.exists({ complaintRef: complaint._id, status: "pending" }).session(
              dbSession,
            )
          )
            throw new ForwardingError("Decide the pending archive request before forwarding.");
          notifications.push({
            userRef: complaint.assignedStaffRef,
            type: "complaint_assigned",
            title: "Complaint forwarded to your office",
            body: `OSAS forwarded ${complaint.ticketNumber} for handling.`,
            relatedComplaintRef: complaint._id,
          });
          notifications.push({
            userRef: complaint.studentRef,
            type: "status_updated",
            title: "Complaint forwarded",
            body: `OSAS forwarded your complaint to ${request.requestedDestination.toUpperCase()}.`,
            relatedComplaintRef: complaint._id,
          });
        }
      }
      await Notification.create(notifications, { session: dbSession, ordered: true });
      result = request.toObject();
    });
  } catch (error: any) {
    if (error.code === 11000)
      throw new ForwardingError("A forwarding request is already pending for this complaint.");
    throw error;
  } finally {
    await dbSession.endSession();
  }
  return result;
}
