import { Types } from "mongoose";
import { Category } from "@/models/Category";
import { Office } from "@/models/Office";
import { RoutingRule } from "@/models/RoutingRule";
import { SLARule } from "@/models/SLARule";

const OSAS_CODE = "OSAS";
const OVPAA_CODE = "OVPAA";

function sameId(a: unknown, b: unknown) {
  return String(a ?? "") === String(b ?? "");
}

export async function getOsasOffice() {
  return Office.findOne({ code: OSAS_CODE, isActive: true }).lean();
}

export async function getOvpaaOffice() {
  return Office.findOne({ code: OVPAA_CODE, isActive: true }).lean();
}

export async function isComplaintInOsasActionScope(complaint: any): Promise<boolean> {
  const osasOffice = await getOsasOffice();
  if (!osasOffice) return false;
  const osasOfficeId = String((osasOffice as any)._id);
  if (sameId(complaint.assignedOfficeRef, osasOfficeId)) return true;

  const [category, routingRule, slaRule] = await Promise.all([
    complaint.categoryRef ? Category.findById(complaint.categoryRef).select("defaultOfficeRef").lean() : null,
    complaint.categoryRef
      ? RoutingRule.findOne({ categoryRef: complaint.categoryRef, isActive: true }).select("targetOfficeRef").lean()
      : null,
    complaint.categoryRef
      ? SLARule.findOne({ categoryRef: complaint.categoryRef, isActive: true }).select("escalateToOfficeRef").lean()
      : null,
  ]);

  return (
    sameId((category as any)?.defaultOfficeRef, osasOfficeId) ||
    sameId((routingRule as any)?.targetOfficeRef, osasOfficeId) ||
    sameId((slaRule as any)?.escalateToOfficeRef, osasOfficeId)
  );
}

export async function getOsasAllowedDestinationOffices(complaint: any) {
  if (!(await isComplaintInOsasActionScope(complaint))) return [];

  const ids = new Set<string>();
  const [osasOffice, ovpaaOffice, category, routingRule, slaRule, collegeOffices] = await Promise.all([
    getOsasOffice(),
    getOvpaaOffice(),
    complaint.categoryRef ? Category.findById(complaint.categoryRef).select("defaultOfficeRef").lean() : null,
    complaint.categoryRef
      ? RoutingRule.findOne({ categoryRef: complaint.categoryRef, isActive: true }).select("targetOfficeRef").lean()
      : null,
    complaint.categoryRef
      ? SLARule.findOne({ categoryRef: complaint.categoryRef, isActive: true }).select("escalateToOfficeRef").lean()
      : null,
    Office.find({ type: "college_office", isActive: true }).select("name code type").sort({ name: 1 }).lean(),
  ]);

  for (const office of [osasOffice, ovpaaOffice]) {
    if (office) ids.add(String((office as any)._id));
  }
  for (const ref of [
    complaint.assignedOfficeRef,
    (category as any)?.defaultOfficeRef,
    (routingRule as any)?.targetOfficeRef,
    (slaRule as any)?.escalateToOfficeRef,
  ]) {
    if (ref && Types.ObjectId.isValid(String(ref))) ids.add(String(ref));
  }
  for (const office of collegeOffices as any[]) ids.add(String(office._id));

  return Office.find({ _id: { $in: [...ids] }, isActive: true })
    .select("name code type")
    .sort({ name: 1 })
    .lean();
}

export async function getOsasEscalationOffice(complaint: any) {
  const rule = complaint.categoryRef
    ? await SLARule.findOne({ categoryRef: complaint.categoryRef, isActive: true })
        .select("escalateToOfficeRef")
        .lean()
    : null;
  if ((rule as any)?.escalateToOfficeRef) {
    const configured = await Office.findById((rule as any).escalateToOfficeRef)
      .select("name code type isActive")
      .lean();
    if (configured && (configured as any).isActive) return configured;
  }
  return getOvpaaOffice();
}
