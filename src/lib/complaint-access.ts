import { getAdminScope, isComplaintInAdminScope } from "@/lib/admin-scope";
import {
  staffComplaintFilter,
  refId,
  canProcessComplaint,
  canSuperviseComplaint,
} from "@/lib/osas-operations";
import { Complaint } from "@/models/Complaint";
export async function canAccessComplaint(session: any, complaint: any): Promise<boolean> {
  const { role, id } = session.user;
  if (role === "administrator") return true;
  if (role === "student") return refId(complaint.studentRef) === id;
  if (role === "vpaa" || role === "vpaf")
    return isComplaintInAdminScope(getAdminScope(role), complaint);
  if (role === "osas" || role === "office_staff")
    return Boolean(
      await Complaint.exists({ _id: complaint._id, ...(await staffComplaintFilter(session)) }),
    );
  return false;
}
export async function canAccessInternalComplaintNotes(
  session: any,
  complaint: any,
): Promise<boolean> {
  return session.user.role !== "student" && canAccessComplaint(session, complaint);
}
export async function canWriteInternalComplaintNotes(
  session: any,
  complaint: any,
): Promise<boolean> {
  if (["closed", "withdrawn"].includes(complaint.status)) return false;
  return (
    (await canProcessComplaint(session, complaint)) ||
    (!complaint.isArchived && (await canSuperviseComplaint(session, complaint)))
  );
}
