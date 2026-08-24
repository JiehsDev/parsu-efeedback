// src/features/admin/schemas/category.schema.ts
import { z } from "zod";
import { PRIORITY_LEVELS } from "@/lib/constants";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  defaultOfficeRef: z.string().min(1).optional(),
  defaultPriority: z.enum(PRIORITY_LEVELS),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;