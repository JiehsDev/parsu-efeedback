// src/features/routing-engine/services/routing.service.ts
// BR-025..BR-028. Strict mode: routing is mandatory. If no active rule
// exists for the category, its conditions don't match, or its target
// office has gone inactive, submission fails loudly — this is treated
// as a data-integrity problem for an admin to fix, not something to
// paper over with a silent default.

import { RoutingRule } from "@/models/RoutingRule";
import { Office } from "@/models/Office";
import type { PriorityLevel } from "@/lib/constants";

export class RoutingError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

interface RouteComplaintParams {
  categoryId: string;
  studentCollegeRef: string | null;
  priority: PriorityLevel;
}

export async function resolveRoutingOffice(
  params: RouteComplaintParams,
): Promise<{ officeRef: string }> {
  const { categoryId, studentCollegeRef, priority } = params;

  const rule = await RoutingRule.findOne({
    categoryRef: categoryId,
    isActive: true,
  }).lean();

  if (!rule) {
    throw new RoutingError(
      "No active routing rule exists for this category. Contact an administrator.",
      "NO_ACTIVE_RULE",
    );
  }

  const conditions = (rule as any).conditions ?? {};
  const collegeMatches =
    !conditions.collegeRef || String(conditions.collegeRef) === studentCollegeRef;
  const priorityMatches = !conditions.priority || conditions.priority === priority;

  if (!collegeMatches || !priorityMatches) {
    throw new RoutingError(
      "The active routing rule for this category does not cover this complaint's college/priority combination. Contact an administrator.",
      "RULE_CONDITIONS_NOT_MET",
    );
  }

  // BR-028: rule must not reference an inactive office
  const targetOffice = await Office.findById((rule as any).targetOfficeRef).lean();
  if (!targetOffice || !(targetOffice as any).isActive) {
    throw new RoutingError(
      "The routing rule for this category points to an inactive office. Contact an administrator.",
      "TARGET_OFFICE_INACTIVE",
    );
  }

  return { officeRef: String((rule as any).targetOfficeRef) };
}
