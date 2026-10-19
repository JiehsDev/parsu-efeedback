// src/features/complaints/schemas/assign.schema.ts
import { z } from "zod";

export const assignComplaintSchema = z
  .object({
    assignedOfficeRef: z.string().min(1).optional(),
    assignedStaffRef: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Select a valid staff member.")
      .nullable()
      .optional(),
    message: z.string().trim().optional(),
    action: z.enum(["assign", "reassign", "escalate"]).optional(),
  })
  .refine((data) => data.assignedOfficeRef !== undefined || data.assignedStaffRef !== undefined, {
    message: "At least one of assignedOfficeRef or assignedStaffRef must be provided",
  })
  .refine((data) => data.action === "escalate" || Boolean(data.assignedStaffRef), {
    message: "Select a staff member to assign this complaint to.",
    path: ["assignedStaffRef"],
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
