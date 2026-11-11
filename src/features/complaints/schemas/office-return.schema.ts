import { z } from "zod";

export const createOfficeReturnRequestSchema = z.object({
  reason: z.string().trim().min(10, "Explain why this complaint should return to OSAS.").max(2000),
});

export const decideOfficeReturnRequestSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(2000).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.action === "reject" && value.reason.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explain why the complaint should remain with the receiving office.",
      });
    }
  });
