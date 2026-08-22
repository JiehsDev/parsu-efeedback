// src/features/notifications/schemas/broadcast.schema.ts
import { z } from "zod";
import { USER_ROLES } from "@/lib/constants";

export const broadcastNotificationSchema = z
  .object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    audience: z.enum(["all", "role", "office"]),
    role: z.enum(USER_ROLES).optional(),
    officeRef: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audience === "role" && !data.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "role is required when audience is \"role\"",
        path: ["role"],
      });
    }
    if (data.audience === "office" && !data.officeRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "officeRef is required when audience is \"office\"",
        path: ["officeRef"],
      });
    }
  });

export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
