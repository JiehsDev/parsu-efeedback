import { Types } from "mongoose";
import { Complaint } from "@/models/Complaint";
import { Category } from "@/models/Category";
import { Office } from "@/models/Office";
import { RoutingRule } from "@/models/RoutingRule";
import { SLARule } from "@/models/SLARule";

const OSAS_CODE = "OSAS";
const OVPAA_CODE = "OVPAA";

export async function getOsasOffice() {
  return Office.findOne({ code: OSAS_CODE, isActive: true }).lean();
}

export async function getOvpaaOffice() {
  return Office.findOne({ code: OVPAA_CODE, isActive: true }).lean();
}

// Include inactive offices/categories as well: historical OSAS complaints
// retain their privacy after configuration changes or office reassignment.
export async function getOsasComplaintFilter(): Promise<Record<string, unknown>> {
  const office = await Office.findOne({ code: OSAS_CODE }).select("_id").lean();
  if (!office) return { _id: { $in: [] } };
  const officeId = office._id;
  const [categories, routes, rules] = await Promise.all([
    Category.find({ defaultOfficeRef: officeId }).select("_id").lean(),
    RoutingRule.find({ targetOfficeRef: officeId, isActive: true }).select("categoryRef").lean(),
    SLARule.find({ escalateToOfficeRef: officeId, isActive: true }).select("categoryRef").lean(),
  ]);
  const categoryIds = [
    ...categories.map((category) => category._id),
    ...routes.map((route) => route.categoryRef),
    ...rules.map((rule) => rule.categoryRef),
  ].filter(Boolean);
  return { $or: [{ assignedOfficeRef: officeId }, { categoryRef: { $in: categoryIds } }] };
}

export async function isComplaintInOsasActionScope(complaint: any): Promise<boolean> {
  if (!complaint._id) return false;
  return Boolean(
    await Complaint.exists({
      _id: complaint._id,
      ...(await getOsasComplaintFilter()),
    }),
  );
}

export async function getOsasAllowedDestinationOffices(complaint: any) {
  if (!(await isComplaintInOsasActionScope(complaint))) return [];

  const ids = new Set<string>();
  const [osasOffice, ovpaaOffice, category, routingRule, slaRule, collegeOffices] =
    await Promise.all([
      getOsasOffice(),
      getOvpaaOffice(),
      complaint.categoryRef
        ? Category.findById(complaint.categoryRef).select("defaultOfficeRef").lean()
        : null,
      complaint.categoryRef
        ? RoutingRule.findOne({ categoryRef: complaint.categoryRef, isActive: true })
            .select("targetOfficeRef")
            .lean()
        : null,
      complaint.categoryRef
        ? SLARule.findOne({ categoryRef: complaint.categoryRef, isActive: true })
            .select("escalateToOfficeRef")
            .lean()
        : null,
      Office.find({ type: "college_office", isActive: true })
        .select("name code type")
        .sort({ name: 1 })
        .lean(),
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
