import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyArchiveRequested, notifyComplaintRestored } from "@/features/notifications/services/notification.service";
import { archiveEligibility } from "@/lib/archive-policy";
export { archiveEligibility } from "@/lib/archive-policy";

export async function getComplaintOfficeHead(officeId: unknown) {
  if (!officeId) return null;
  const office = await Office.findById(officeId).select("headUserRef name").lean();
  if (!office?.headUserRef) return null;
  const head = await User.findById(office.headUserRef).select("firstName lastName email role").lean();
  return head ? { office, head } : null;
}

export { isOfficeHead } from "@/lib/office-head";

export async function archiveComplaint(params: {
  complaintId: string;
  actorId: string;
  reason: string;
  source: "staff_request_approved" | "office_head_direct" | "administrator_direct";
  requestId?: string;
}) {
  const complaint = await Complaint.findById(params.complaintId);
  if (!complaint) return { error: "Complaint not found", status: 404 as const };
  if (complaint.isArchived) return { error: "Complaint is already archived", status: 409 as const };
  const eligibility = archiveEligibility(complaint.status);
  if (eligibility) return { error: eligibility, status: 400 as const };

  const before = complaint.toObject();
  const now = new Date();
  complaint.isArchived = true;
  complaint.archivedAt = now;
  complaint.archivedByRef = params.actorId as any;
  complaint.archiveReason = params.reason;
  complaint.archiveSource = params.source;
  await complaint.save();

  await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "archived", actorRef: params.actorId, message: params.reason });
  await writeAuditLog({ actorId: params.actorId, action: "complaint.archive", entityType: "Complaint", entityId: complaint._id, beforeState: { isArchived: before.isArchived }, afterState: { isArchived: true, archiveReason: params.reason, archiveSource: params.source } });
  if (params.requestId) {
    await ArchiveRequest.findByIdAndUpdate(params.requestId, { status: "approved", reviewedByRef: params.actorId, reviewedAt: now });
  }
  return { complaint };
}

export async function restoreComplaint(params: { complaintId: string; actorId: string; reason?: string }) {
  const complaint = await Complaint.findById(params.complaintId);
  if (!complaint) return { error: "Complaint not found", status: 404 as const };
  if (!complaint.isArchived) return { error: "Complaint is not archived", status: 409 as const };
  const before = complaint.toObject();
  complaint.isArchived = false;
  complaint.restoredAt = new Date();
  complaint.restoredByRef = params.actorId as any;
  complaint.restoreReason = params.reason ?? "";
  await complaint.save();
  await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "restored", actorRef: params.actorId, message: params.reason ?? "Complaint restored" });
  await writeAuditLog({ actorId: params.actorId, action: "complaint.restore", entityType: "Complaint", entityId: complaint._id, beforeState: { isArchived: before.isArchived }, afterState: { isArchived: false, restoreReason: params.reason ?? "" } });
  await notifyComplaintRestored({ studentId: String(complaint.studentRef), ticketNumber: complaint.ticketNumber, complaintId: String(complaint._id) });
  return { complaint };
}

export async function notifyHeadForArchiveRequest(complaintId: string, requestId: string, reason: string) {
  const complaint = await Complaint.findById(complaintId).select("ticketNumber title assignedOfficeRef").lean();
  const target = complaint ? await getComplaintOfficeHead(complaint.assignedOfficeRef) : null;
  const request = await ArchiveRequest.findById(requestId).populate("requestedByRef", "firstName lastName").lean();
  const requester = request?.requestedByRef as any;
  if (complaint && target) await notifyArchiveRequested({ userId: String((target as any).head._id), ticketNumber: complaint.ticketNumber, complaintId, requestId, reason, complaintTitle: complaint.title, requesterName: requester ? `${requester.firstName} ${requester.lastName}` : undefined });
}
