// src/features/sla/schemas/sla-rule.schema.ts
import { z } from "zod";
import { PRIORITY_LEVELS } from "@/lib/constants";

export const createSlaRuleSchema = z.object({
  categoryRef: z.string().min(1).nullable().optional().default(null),
  priority: z.enum(PRIORITY_LEVELS),
  responseHours: z.number().positive(),
  resolutionHours: z.number().positive(),
  warningThresholdPercent: z.number().min(1).max(100).optional().default(80),
  escalateToOfficeRef: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateSlaRuleSchema = createSlaRuleSchema.partial();

export type CreateSlaRuleInput = z.infer<typeof createSlaRuleSchema>;
export type UpdateSlaRuleInput = z.infer<typeof updateSlaRuleSchema>;
