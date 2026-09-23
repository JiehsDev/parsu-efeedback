import { Complaint, type ComplaintDocument } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyAssignmentReleased } from "@/features/notifications/services/notification.service";
import type { UserRole } from "@/lib/constants";

const BLOCKED_STATUSES = new Set(["resolved", "closed", "withdrawn"]);

export type ReleaseAssignmentResult =
  | { complaint: ComplaintDocument }
  | { error: string; status: number };

export async function releaseAssignment(params: {
  complaintId: string;
  actorId: string;
  actorRole: UserRole;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ReleaseAssignmentResult> {
  if (params.actorRole !== "office_staff") {
    return { error: "Only the assigned office staff member can release this complaint.", status: 403 };
  }
  if (!params.reason?.trim()) return { error: "A release reason is required.", status: 400 };

  const complaint = await Complaint.findById(params.complaintId);
  if (!complaint) return { error: "Complaint not found", status: 404 };
  if (complaint.isArchived) return { error: "Archived complaints cannot be released.", status: 400 };
  if (BLOCKED_STATUSES.has(complaint.status)) {
    return { error: "Resolved, closed, and withdrawn complaints cannot be released.", status: 400 };
  }
  if (!complaint.assignedStaffRef || String(complaint.assignedStaffRef) !== params.actorId) {
    return { error: "Only the currently assigned staff member can release this complaint.", status: 403 };
  }
  if (!complaint.assignedOfficeRef) return { error: "Complaint has no assigned office.", status: 400 };

  const office = await Office.findById(complaint.assignedOfficeRef).select("name").lean();
  if (!office) return { error: "Complaint office not found.", status: 400 };

  const reason = params.reason.trim();
  const before = {
    assignedOfficeRef: complaint.assignedOfficeRef,
    assignedStaffRef: complaint.assignedStaffRef,
    status: complaint.status,
  };

  complaint.assignedStaffRef = null;
  complaint.status = "submitted";
  await complaint.save();

  await Assignment.create({
    complaintRef: complaint._id,
    assignedByRef: params.actorId,
    assignedToRef: null,
    sourceOfficeRef: complaint.assignedOfficeRef,
    destinationOfficeRef: complaint.assignedOfficeRef,
    reason,
    actionType: "release",
  });

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "assignment_released",
    actorRef: params.actorId,
    fromValue: before.status,
    toValue: "submitted",
    message: `Complaint returned to Submitted and is awaiting reassignment. Reason: ${reason}`,
  });

  await writeAuditLog({
    actorId: params.actorId,
    action: "ASSIGNMENT_RELEASED",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: before,
    afterState: {
      assignedOfficeRef: complaint.assignedOfficeRef,
      assignedStaffRef: null,
      status: "submitted",
      reason,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  await notifyAssignmentReleased({
    officeId: String(complaint.assignedOfficeRef),
    ticketNumber: complaint.ticketNumber,
    complaintId: String(complaint._id),
    reason,
  });

  return { complaint };
}
