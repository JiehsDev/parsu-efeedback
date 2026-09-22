// src/features/complaints/services/resolution-closure.service.ts
//
// Rating is optional (see docs/superpowers/specs — resolved->closed rework):
// a resolved complaint closes either because the student rated it
// (closeComplaintWithRating) or explicitly declined to
// (closeComplaintWithoutRating). Both share the same ownership/status
// guards and both stamp closureType/closedByRef so analytics and the UI
// can tell the two apart without inferring it from studentRating being
// null (which is also true of "not yet closed").
import { Complaint, type ComplaintDocument } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyComplaintClosedByStudent } from "@/features/notifications/services/notification.service";

export type ResolutionClosureResult =
  | { complaint: ComplaintDocument }
  | { error: string; status: number };

async function loadEligibleResolvedComplaint(complaintId: string, studentId: string) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return { error: "Complaint not found", status: 404 as const };
  if (String(complaint.studentRef) !== studentId) {
    return { error: "Forbidden", status: 403 as const };
  }
  if (complaint.isArchived) {
    return { error: "Archived complaints cannot be closed.", status: 400 as const };
  }
  if (complaint.status !== "resolved") {
    return { error: "Only resolved complaints can be closed by the student.", status: 400 as const };
  }
  return { complaint };
}

export async function closeComplaintWithRating(params: {
  complaintId: string;
  studentId: string;
  rating: number;
  comment?: string;
}): Promise<ResolutionClosureResult> {
  const loaded = await loadEligibleResolvedComplaint(params.complaintId, params.studentId);
  if ("error" in loaded) return loaded;
  const { complaint } = loaded;

  if (complaint.studentRating !== null) {
    return { error: "Complaint already rated", status: 409 };
  }

  complaint.studentRating = params.rating;
  complaint.studentRatingComment = params.comment ?? "";
  complaint.status = "closed";
  complaint.closedAt = new Date();
  complaint.closureType = "rated";
  complaint.closedByRef = params.studentId as any;
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "rated",
    actorRef: params.studentId,
    toValue: String(params.rating),
    message: "Student submitted a satisfaction rating and closed the complaint.",
  });
  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "closed",
    actorRef: params.studentId,
    fromValue: "resolved",
    toValue: "closed",
    message: "Complaint closed after student rating.",
  });

  await writeAuditLog({
    actorId: params.studentId,
    action: "COMPLAINT_RATED",
    entityType: "Complaint",
    entityId: complaint._id,
    afterState: { studentRating: params.rating, hasComment: Boolean(params.comment) },
  });
  await writeAuditLog({
    actorId: params.studentId,
    action: "COMPLAINT_CLOSED",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: "resolved" },
    afterState: { status: "closed", closureType: "rated" },
  });

  await notifyComplaintClosedByStudent({
    complaintId: String(complaint._id),
    ticketNumber: complaint.ticketNumber,
    officeId: complaint.assignedOfficeRef ? String(complaint.assignedOfficeRef) : null,
    assignedStaffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
    closureType: "rated",
    rating: params.rating,
  });

  return { complaint };
}

export async function closeComplaintWithoutRating(params: {
  complaintId: string;
  studentId: string;
}): Promise<ResolutionClosureResult> {
  const loaded = await loadEligibleResolvedComplaint(params.complaintId, params.studentId);
  if ("error" in loaded) return loaded;
  const { complaint } = loaded;

  complaint.status = "closed";
  complaint.closedAt = new Date();
  complaint.closureType = "without_rating";
  complaint.closedByRef = params.studentId as any;
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "closed",
    actorRef: params.studentId,
    fromValue: "resolved",
    toValue: "closed",
    message: "Student closed the complaint without submitting a rating.",
  });

  await writeAuditLog({
    actorId: params.studentId,
    action: "COMPLAINT_CLOSED",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: "resolved" },
    afterState: { status: "closed", closureType: "without_rating" },
  });

  await notifyComplaintClosedByStudent({
    complaintId: String(complaint._id),
    ticketNumber: complaint.ticketNumber,
    officeId: complaint.assignedOfficeRef ? String(complaint.assignedOfficeRef) : null,
    assignedStaffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
    closureType: "without_rating",
  });

  return { complaint };
}
