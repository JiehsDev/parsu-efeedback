// src/features/routing-engine/schemas/routing-rule.schema.ts
import { z } from "zod";
import { PRIORITY_LEVELS } from "@/lib/constants";

export const createRoutingRuleSchema = z.object({
  categoryRef: z.string().min(1),
  targetOfficeRef: z.string().min(1),
  conditions: z
    .object({
      collegeRef: z.string().nullable().optional(),
      priority: z.enum(PRIORITY_LEVELS).nullable().optional(),
    })
    .optional()
    .default({}),
  priority: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateRoutingRuleSchema = createRoutingRuleSchema.partial();

export type CreateRoutingRuleInput = z.infer<typeof createRoutingRuleSchema>;
export type UpdateRoutingRuleInput = z.infer<typeof updateRoutingRuleSchema>;
