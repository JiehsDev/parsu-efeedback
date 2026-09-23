import { z } from "zod";

export const releaseAssignmentSchema = z.object({
  reason: z.string().trim().min(1, "A release reason is required."),
});

export type ReleaseAssignmentInput = z.infer<typeof releaseAssignmentSchema>;
