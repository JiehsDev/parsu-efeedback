// src/features/settings/schemas/settings.schema.ts
import { z } from "zod";

export const updateSettingsSchema = z.object({
  ticketNumberPrefix: z.string().trim().min(1).max(20).optional(),
  uploadMaxFileSizeMb: z.number().positive().max(100).optional(),
  uploadAllowedMimeTypes: z.array(z.string().trim().min(1)).min(1).optional(),
  authMaxFailedLoginAttempts: z.number().int().positive().max(20).optional(),
  authLockoutDurationMinutes: z.number().int().positive().max(1440).optional(),
  authSessionMaxAgeMinutes: z.number().int().positive().max(10080).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
