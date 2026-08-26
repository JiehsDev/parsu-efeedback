// src/features/complaints/schemas/complaint.schema.ts
import { z } from "zod";

export const createComplaintSchema = z.object({
  categoryRef: z.string().min(1),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum([
    "submitted",
    "assigned",
    "in_progress",
    "pending_information",
    "escalated",
    "resolved",
    "closed",
  ]),
  message: z.string().trim().optional(),
});

export const addNoteSchema = z.object({
  body: z.string().trim().min(1),
});

export const rateComplaintSchema = z.object({
  studentRating: z.number().int().min(1).max(5),
  studentRatingComment: z.string().trim().optional().default(""),
});

// BR-045: administrator-only, hides a complaint from active views without
// deleting the record — never a status, so it's its own boolean rather
// than folded into updateComplaintStatusSchema.
export const archiveComplaintSchema = z.object({
  isArchived: z.boolean(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type RateComplaintInput = z.infer<typeof rateComplaintSchema>;
export type ArchiveComplaintInput = z.infer<typeof archiveComplaintSchema>;
