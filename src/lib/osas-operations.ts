import { Office } from "@/models/Office";

export function refId(value: any): string {
  return String(value?._id ?? value ?? "");
}

export function isOversightRole(role: string): boolean {
  return role === "vpaa" || role === "vpaf";
}

export async function getOperationalOffice() {
  return Office.findOne({ code: "OSAS", isActive: true }).lean();
}

export async function isOsasHead(session: any): Promise<boolean> {
  if (!session?.user || !["osas", "office_staff"].includes(session.user.role)) return false;
  const office = await getOperationalOffice();
  return Boolean(office && refId(office.headUserRef) === session.user.id);
}

export async function isOsasComplaint(complaint: any): Promise<boolean> {
  const office = await getOperationalOffice();
  return Boolean(office && refId(complaint.assignedOfficeRef) === refId(office._id));
}

export async function canProcessComplaint(session: any, complaint: any): Promise<boolean> {
  if (!session?.user || complaint.isArchived) return false;
  // Retain the pre-existing administrator emergency override at API level.
  if (session.user.role === "administrator") return true;
  if (!["osas", "office_staff"].includes(session.user.role)) return false;
  const office = await getOperationalOffice();
  return Boolean(
    office &&
    refId(session.user.officeRef) === refId(office._id) &&
    refId(complaint.assignedOfficeRef) === refId(office._id) &&
    refId(complaint.assignedStaffRef) === session.user.id,
  );
}

export async function canSuperviseComplaint(session: any, complaint: any): Promise<boolean> {
  return (await isOsasHead(session)) && (await isOsasComplaint(complaint));
}

export async function staffComplaintFilter(session: any): Promise<Record<string, unknown>> {
  const office = await getOperationalOffice();
  if (!office || !["office_staff", "osas"].includes(session.user.role)) return { _id: { $in: [] } };
  if (refId(session.user.officeRef) !== refId(office._id)) return { _id: { $in: [] } };
  // Office membership controls reading; handler assignment controls mutations.
  // Keep this independent of lifecycle status so resolved cases remain visible.
  return { assignedOfficeRef: office._id };
}
