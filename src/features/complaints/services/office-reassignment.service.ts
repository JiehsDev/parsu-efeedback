// src/features/complaints/services/office-reassignment.service.ts
//
// REASSIGN OFFICE — a lateral transfer of a complaint to another office of
// the same/equivalent organizational level, distinct from Escalate (upward,
// server-computed target). Only the current office's Office Head
// (Office.headUserRef === actorId) may do this; administrator bypasses both
// the head check and the lateral-eligibility check (the established
// "administrator unrestricted everywhere" convention used elsewhere in this
// codebase). See src/lib/office-reassignment-scope.ts for the eligibility
// rule.
import { Complaint, type ComplaintDocument } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyOfficeReassignment } from "@/features/notifications/services/notification.service";
import { isOfficeHead } from "@/lib/office-head";
import { getEligibleReassignmentOffices } from "@/lib/office-reassignment-scope";
import type { UserRole } from "@/lib/constants";

export type OfficeReassignmentResult =
  | { complaint: ComplaintDocument }
  | { error: string; status: number };

const BLOCKED_STATUSES = new Set(["resolved", "closed", "withdrawn"]);

export async function reassignOffice(params: {
  complaintId: string;
  actorId: string;
  actorRole: UserRole;
  destinationOfficeId: string;
  reason: string;
}): Promise<OfficeReassignmentResult> {
  const complaint = await Complaint.findById(params.complaintId);
  if (!complaint) return { error: "Complaint not found", status: 404 };

  if (complaint.isArchived) {
    return { error: "Archived complaints cannot be reassigned.", status: 400 };
  }
  if (BLOCKED_STATUSES.has(complaint.status)) {
    return {
      error: "Resolved, closed, and withdrawn complaints cannot be reassigned to another office.",
      status: 400,
    };
  }
  if (!complaint.assignedOfficeRef) {
    return { error: "Complaint has no current office to reassign from.", status: 400 };
  }
  if (!params.reason?.trim()) {
    return { error: "A reason is required to reassign this complaint.", status: 400 };
  }

  const isAdmin = params.actorRole === "administrator";
  if (!isAdmin) {
    const actorIsHead = await isOfficeHead(params.actorId, complaint.assignedOfficeRef);
    if (!actorIsHead) {
      return {
        error: "Only the office head may reassign this complaint to another office.",
        status: 403,
      };
    }
  }

  const currentOffice = await Office.findById(complaint.assignedOfficeRef).lean();
  if (!currentOffice || !(currentOffice as any).isActive) {
    return { error: "The complaint's current office is not available.", status: 400 };
  }

  if (String(complaint.assignedOfficeRef) === params.destinationOfficeId) {
    return { error: "Cannot reassign a complaint to its current office.", status: 400 };
  }

  const destinationOffice = await Office.findById(params.destinationOfficeId).lean();
  if (!destinationOffice || !(destinationOffice as any).isActive) {
    return { error: "Destination office not found or inactive.", status: 400 };
  }

  if (!isAdmin) {
    const eligible = await getEligibleReassignmentOffices(currentOffice as any);
    const isEligible = eligible.some((office: any) => String(office._id) === params.destinationOfficeId);
    if (!isEligible) {
      return {
        error:
          "This office is not an eligible reassignment destination. Use escalation if a higher authority is required.",
        status: 400,
      };
    }
  }

  const before = {
    assignedOfficeRef: complaint.assignedOfficeRef,
    assignedStaffRef: complaint.assignedStaffRef,
  };

  complaint.assignedOfficeRef = destinationOffice._id as any;
  complaint.assignedStaffRef = null;
  await complaint.save();

  await Assignment.create({
    complaintRef: complaint._id,
    assignedByRef: params.actorId,
    assignedToRef: null,
    sourceOfficeRef: (currentOffice as any)._id,
    destinationOfficeRef: destinationOffice._id,
    reason: params.reason,
    actionType: "office_reassignment",
  });

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "reassigned",
    actorRef: params.actorId,
    fromValue: (currentOffice as any).name,
    toValue: (destinationOffice as any).name,
    message: `Complaint reassigned from ${(currentOffice as any).name} to ${(destinationOffice as any).name}. Reason: ${params.reason}`,
  });

  await writeAuditLog({
    actorId: params.actorId,
    action: "OFFICE_REASSIGNED",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: {
      assignedOfficeRef: before.assignedOfficeRef,
      assignedStaffRef: before.assignedStaffRef,
    },
    afterState: {
      assignedOfficeRef: destinationOffice._id,
      assignedStaffRef: null,
      reason: params.reason,
    },
  });

  await notifyOfficeReassignment({
    studentId: String(complaint.studentRef),
    ticketNumber: complaint.ticketNumber,
    complaintId: String(complaint._id),
    destinationOfficeId: String(destinationOffice._id),
    destinationOfficeName: (destinationOffice as any).name,
    previousStaffId: before.assignedStaffRef ? String(before.assignedStaffRef) : null,
  });

  return { complaint };
}
