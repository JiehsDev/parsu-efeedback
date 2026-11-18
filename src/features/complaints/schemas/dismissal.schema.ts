import { z } from "zod";

export const dismissalReasonCodes = [
  "duplicate",
  "invalid",
  "outside_scope",
  "spam",
  "no_action_required",
  "addressed_elsewhere",
  "other",
] as const;

export const dismissalRequestSchema = z.object({
  reasonCode: z.enum(dismissalReasonCodes),
  reasonText: z
    .string()
    .trim()
    .min(10, "Explain the decision in at least 10 characters.")
    .max(2000),
  internalNote: z.string().trim().max(2000).optional().default(""),
});

export const dismissalDecisionSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    rejectionReason: z.string().trim().max(2000).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.action === "reject" && !value.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Add a reason for rejection.",
      });
    }
  });
