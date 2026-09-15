import { getAdminScope, isComplaintInAdminScope } from "@/lib/admin-scope";

export async function canAccessComplaint(session: any, complaint: any): Promise<boolean> {
  const { role, id, officeRef } = session.user;

  if (role === "administrator") return true;
  if (role === "student") return String(complaint.studentRef) === id;
  if (role === "office_staff") return String(complaint.assignedOfficeRef) === officeRef;
  if (role === "vpaa" || role === "vpaf" || role === "osas") {
    return isComplaintInAdminScope(getAdminScope(role), complaint);
  }

  return false;
}

export async function canAccessInternalComplaintNotes(
  session: any,
  complaint: any,
): Promise<boolean> {
  if (session.user.role === "student") return false;
  return canAccessComplaint(session, complaint);
}
