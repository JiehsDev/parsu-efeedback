// Supervisory escalation stays within OSAS; legacy office hierarchy is ignored.
import { User } from "@/models/User";
import { getOperationalOffice, refId } from "@/lib/osas-operations";
import type { UserRole } from "@/lib/constants";
export { isOfficeHead } from "@/lib/office-head";
export type ManualEscalationTarget = {
  office: any;
  staff: any;
  currentOffice: any;
  currentStaffIsHead: boolean;
};
export async function resolveManualEscalationTarget(
  complaint: any,
  actorRole?: UserRole,
): Promise<ManualEscalationTarget | null> {
  if (actorRole && ["vpaa", "vpaf"].includes(actorRole)) return null;
  const office = await getOperationalOffice();
  if (
    !office ||
    refId(complaint.assignedOfficeRef) !== refId(office._id) ||
    !office.headUserRef ||
    refId(complaint.assignedStaffRef) === refId(office.headUserRef)
  )
    return null;
  const staff = await User.findOne({
    _id: office.headUserRef,
    officeRef: office._id,
    isActive: true,
    role: { $in: ["osas", "office_staff"] },
  }).lean();
  return staff ? { office, staff, currentOffice: office, currentStaffIsHead: false } : null;
}
