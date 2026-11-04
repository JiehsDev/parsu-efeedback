import { Office } from "@/models/Office";

export function refId(value: any): string {
  return String(value?._id ?? value ?? "");
}

export function isReceivingOfficeRole(role: string): boolean {
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

// Staff membership is distinct from category classification and head authority.
export async function getStaffOffice(session: any) {
  if (
    !session?.user ||
    !["office_staff", "osas"].includes(session.user.role) ||
    !session.user.officeRef
  )
    return null;
  return Office.findOne({
    _id: refId(session.user.officeRef),
    code: { $in: session.user.role === "osas" ? ["OSAS"] : ["OSAS", "OVPAA", "OVPAF"] },
    isActive: true,
  }).lean();
}

function complaintBelongsToOffice(office: any, complaint: any) {
  if (refId(complaint.assignedOfficeRef) !== refId(office._id)) return false;
  if (office.code === "OSAS") return true;
  const role = office.code === "OVPAA" ? "vpaa" : office.code === "OVPAF" ? "vpaf" : null;
  return Boolean(role && complaint.forwardedToRole === role && complaint.forwardedAt);
}

export async function canManageOfficeAssignments(session: any, office: any): Promise<boolean> {
  if (!session?.user || !office?.isActive) return false;
  if (office.code === "OSAS")
    return session.user.role === "administrator" || (await isOsasHead(session));
  const role = office.code === "OVPAA" ? "vpaa" : office.code === "OVPAF" ? "vpaf" : null;
  return Boolean(
    role &&
    session.user.role === role &&
    refId(session.user.officeRef) === refId(office._id) &&
    refId(office.headUserRef) === session.user.id,
  );
}

export async function canAssignComplaint(session: any, complaint: any): Promise<boolean> {
  if (!complaint.assignedOfficeRef) return false;
  const office = await Office.findById(refId(complaint.assignedOfficeRef)).lean();
  return Boolean(
    office &&
    complaintBelongsToOffice(office, complaint) &&
    (await canManageOfficeAssignments(session, office)),
  );
}

export async function canProcessComplaint(session: any, complaint: any): Promise<boolean> {
  if (!session?.user || complaint.isArchived) return false;
  // Retain the pre-existing administrator emergency override at API level.
  if (session.user.role === "administrator") return true;
  if (isReceivingOfficeRole(session.user.role)) {
    const office = await Office.findOne({
      code: session.user.role === "vpaa" ? "OVPAA" : "OVPAF",
      isActive: true,
    }).lean();
    return Boolean(
      office &&
      refId(session.user.officeRef) === refId(office._id) &&
      complaint.forwardedToRole === session.user.role &&
      complaint.forwardedAt &&
      refId(complaint.assignedOfficeRef) === refId(office._id) &&
      refId(complaint.assignedStaffRef) === session.user.id,
    );
  }
  if (!["osas", "office_staff"].includes(session.user.role)) return false;
  const office = await getStaffOffice(session);
  return Boolean(
    office &&
    complaintBelongsToOffice(office, complaint) &&
    refId(complaint.assignedStaffRef) === session.user.id,
  );
}

export async function canSuperviseComplaint(session: any, complaint: any): Promise<boolean> {
  return (await isOsasHead(session)) && (await isOsasComplaint(complaint));
}

export async function staffComplaintFilter(session: any): Promise<Record<string, unknown>> {
  const office = await getStaffOffice(session);
  if (!office) return { _id: { $in: [] } };
  // Office membership controls reading; handler assignment controls mutations.
  // Keep this independent of lifecycle status so resolved cases remain visible.
  return {
    assignedOfficeRef: office._id,
    ...(office.code === "OSAS"
      ? {}
      : {
          forwardedToRole: office.code === "OVPAA" ? "vpaa" : "vpaf",
          forwardedAt: { $ne: null },
        }),
  };
}
