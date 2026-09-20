import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { SLARule } from "@/models/SLARule";
import { getOsasEscalationOffice, isComplaintInOsasActionScope } from "@/lib/osas-complaint-scope";
import type { UserRole } from "@/lib/constants";

export async function isOfficeHead(userId: string, officeId: string) {
  return Boolean(await Office.exists({ _id: officeId, headUserRef: userId, isActive: true }));
}

export type ManualEscalationTarget = {
  office: any;
  staff: any;
  currentOffice: any;
  currentStaffIsHead: boolean;
};

/** Resolve one configured next authority. The caller still enforces role scope. */
export async function resolveManualEscalationTarget(
  complaint: any,
  actorRole?: UserRole,
): Promise<ManualEscalationTarget | null> {
  if (!complaint.assignedOfficeRef) return null;

  const currentOffice = await Office.findById(complaint.assignedOfficeRef).lean();
  if (!currentOffice || !(currentOffice as any).isActive) return null;

  const currentHeadId = (currentOffice as any).headUserRef
    ? String((currentOffice as any).headUserRef)
    : null;
  const currentStaffIsHead = Boolean(
    currentHeadId && String(complaint.assignedStaffRef ?? "") === currentHeadId,
  );

  let targetOffice: any =
    actorRole === "osas" && (await isComplaintInOsasActionScope(complaint))
      ? await getOsasEscalationOffice(complaint)
      : null;
  if (!currentStaffIsHead && currentHeadId) targetOffice = currentOffice;

  if (!targetOffice) {
    targetOffice = (currentOffice as any).parentOffice
      ? await Office.findOne({ _id: (currentOffice as any).parentOffice, isActive: true }).lean()
      : null;
  }

  if (!targetOffice && complaint.categoryRef) {
    const rule = await SLARule.findOne({ categoryRef: complaint.categoryRef, isActive: true })
      .select("escalateToOfficeRef")
      .lean();
    if ((rule as any)?.escalateToOfficeRef) {
      targetOffice = await Office.findOne({
        _id: (rule as any).escalateToOfficeRef,
        isActive: true,
      }).lean();
    }
  }

  if (!targetOffice && (await isComplaintInOsasActionScope(complaint))) {
    targetOffice = await getOsasEscalationOffice(complaint);
  }

  if (!targetOffice) {
    const fallbackCode = (currentOffice as any).type === "college_office" ? "OVPAA" : "OVPAF";
    targetOffice = await Office.findOne({ code: fallbackCode, isActive: true }).lean();
  }

  if (
    !targetOffice ||
    (currentStaffIsHead && String((targetOffice as any)._id) === String((currentOffice as any)._id))
  ) {
    return null;
  }

  const headId = (targetOffice as any).headUserRef;
  if (!headId) return null;
  const staff = await User.findOne({ _id: headId, role: "office_staff", isActive: true })
    .select("_id firstName lastName email officeRef")
    .lean();
  if (!staff) return null;

  return { office: targetOffice, staff, currentOffice, currentStaffIsHead };
}
