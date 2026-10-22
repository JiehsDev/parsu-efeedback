// Retained compatibility entry point. Office transfer is no longer an operation.
import type { UserRole } from "@/lib/constants";
import type { ComplaintDocument } from "@/models/Complaint";
export type OfficeReassignmentResult =
  { complaint: ComplaintDocument } | { error: string; status: number };
export async function reassignOffice(params: {
  complaintId: string;
  actorId: string;
  actorRole: UserRole;
  destinationOfficeId: string;
  reason: string;
}): Promise<OfficeReassignmentResult> {
  void params;
  return {
    error: "Office reassignment is disabled. OSAS is the only handling office.",
    status: 403,
  };
}
