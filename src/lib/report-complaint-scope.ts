import { complaintFilterForScope, getAdminScope } from "./admin-scope";
import { getOperationalOffice, isOsasHead, staffComplaintFilter } from "./osas-operations";
// OSAS Head reports retain received/forwarded history. Operational queues remain current-office only.
export async function reportComplaintScope(session: any) {
  if (await isOsasHead(session)) {
    const office = await getOperationalOffice();
    return { $or: [{ assignedOfficeRef: office!._id }, { initialOfficeRef: office!._id }] };
  }
  return session.user.role === "office_staff"
    ? staffComplaintFilter(session)
    : complaintFilterForScope(getAdminScope(session.user.role));
}
