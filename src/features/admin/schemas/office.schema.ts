// src/features/admin/schemas/office.schema.ts
import { z } from "zod";
import { OFFICE_TYPES } from "@/lib/constants";

export const createOfficeSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(OFFICE_TYPES),
  code: z.string().trim().min(1).toUpperCase(),
  parentOffice: z.string().nullable().optional(),
  headUserRef: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateOfficeSchema = createOfficeSchema.partial();

export type CreateOfficeInput = z.infer<typeof createOfficeSchema>;
export type UpdateOfficeInput = z.infer<typeof updateOfficeSchema>;