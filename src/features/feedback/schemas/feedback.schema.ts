// src/features/feedback/schemas/feedback.schema.ts
import { z } from "zod";

export const createFeedbackSchema = z.object({
  category: z.string().trim().min(1, "Please select a category"),
  message: z.string().trim().min(10, "Please provide at least 10 characters"),
  isAnonymous: z.boolean().optional().default(false),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
