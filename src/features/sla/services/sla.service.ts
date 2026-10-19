// src/features/sla/services/sla.service.ts
// BR-029..BR-034.

import { SLARule } from "@/models/SLARule";
import type { PriorityLevel } from "@/lib/constants";
import { addSlaHours, type SlaPolicy } from "@/lib/sla-calendar";

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
  rule: { responseHours: number; resolutionHours: number; warningThresholdPercent?: number },
  holidays: readonly string[] = [],
) {
  const slaResponseDueAt = addSlaHours(routedAt, rule.responseHours, holidays);
  const slaResolutionDueAt = addSlaHours(routedAt, rule.resolutionHours, holidays);
  const slaPolicy = {
    version: 1,
    holidays: [...new Set(holidays)].sort(),
    startedAt: routedAt,
    responseHours: rule.responseHours,
    resolutionHours: rule.resolutionHours,
    warningThresholdPercent: rule.warningThresholdPercent ?? 80,
  } satisfies SlaPolicy;
  return { slaResponseDueAt, slaResolutionDueAt, slaPolicy };
}
