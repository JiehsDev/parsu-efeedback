// src/features/sla/services/sla.service.ts
// BR-029..BR-034.

import { SLARule } from "@/models/SLARule";
import type { PriorityLevel } from "@/lib/constants";

interface ResolveSlaRuleParams {
  categoryId: string;
  priority: PriorityLevel;
}

export async function resolveSlaRule(params: ResolveSlaRuleParams) {
  const { categoryId, priority } = params;

  // Category-specific rule first, institution-wide default (categoryRef:
  // null) as fallback — matches the model's stated intent.
  const categoryRule = await SLARule.findOne({
    categoryRef: categoryId,
    priority,
    isActive: true,
  }).lean();

  if (categoryRule) return categoryRule;

  const defaultRule = await SLARule.findOne({
    categoryRef: null,
    priority,
    isActive: true,
  }).lean();

  return defaultRule;
}

export function computeSlaDates(
  routedAt: Date,
  rule: { responseHours: number; resolutionHours: number },
) {
  const slaResponseDueAt = new Date(routedAt.getTime() + rule.responseHours * 60 * 60 * 1000);
  const slaResolutionDueAt = new Date(routedAt.getTime() + rule.resolutionHours * 60 * 60 * 1000);
  return { slaResponseDueAt, slaResolutionDueAt };
}
