import { Types } from "mongoose";
import { Assignment } from "@/models/Assignment";
import { AuditLog } from "@/models/AuditLog";
import type { AssignmentHistoryEntry } from "@/components/shared/AssignmentHistoryPanel";

function displayName(user: any) {
  return user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null;
}

export async function getAssignmentHistoryEntries(
  complaintId: string,
): Promise<AssignmentHistoryEntry[]> {
  const entityIds: unknown[] = [complaintId];
  if (Types.ObjectId.isValid(complaintId)) entityIds.push(new Types.ObjectId(complaintId));

  const [assignments, escalations] = await Promise.all([
    Assignment.find({ complaintRef: complaintId })
      .sort({ createdAt: 1 })
      .populate("sourceOfficeRef", "name")
      .populate("destinationOfficeRef", "name")
      .populate("assignedToRef", "firstName lastName")
      .populate("assignedByRef", "firstName lastName")
      .lean(),
    AuditLog.find({
      entityType: "Complaint",
      entityId: { $in: entityIds },
      action: { $in: ["complaint.sla_escalate", "OSAS_COMPLAINT_ESCALATED"] },
    })
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  return [
    ...assignments.map((assignment: any) => ({
      _id: String(assignment._id),
      kind: "assignment" as const,
      createdAt: new Date(assignment.createdAt).toISOString(),
      sourceOfficeName: assignment.sourceOfficeRef?.name ?? null,
      destinationOfficeName: assignment.destinationOfficeRef?.name ?? null,
      assignedStaffName: displayName(assignment.assignedToRef),
      assignedByName: displayName(assignment.assignedByRef),
      reason: assignment.reason ?? null,
    })),
    ...escalations.map((log: any) => ({
      _id: String(log._id),
      kind: "escalation" as const,
      createdAt: new Date(log.createdAt).toISOString(),
      reason: log.afterState?.reason ?? log.afterState?.escalationReason ?? "SLA escalation",
      destinationOfficeName: null,
      resultingStatus: log.afterState?.status ?? null,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
