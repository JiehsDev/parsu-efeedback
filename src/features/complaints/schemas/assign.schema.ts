// src/features/complaints/schemas/assign.schema.ts
import { z } from "zod";

export const assignComplaintSchema = z
  .object({
    assignedOfficeRef: z.string().min(1).optional(),
    assignedStaffRef: z.string().min(1).nullable().optional(),
    message: z.string().trim().optional(),
    action: z.enum(["assign", "reassign", "escalate"]).optional(),
  })
  .refine((data) => data.assignedOfficeRef !== undefined || data.assignedStaffRef !== undefined, {
    message: "At least one of assignedOfficeRef or assignedStaffRef must be provided",
  })
  .refine(
    (data) =>
      (data.action !== "reassign" && data.action !== "escalate") || Boolean(data.message?.trim()),
    {
      message: "A reason is required for reassignment or escalation",
      path: ["message"],
    },
  );

export type AssignComplaintInput = z.infer<typeof assignComplaintSchema>;
