// src/features/complaints/schemas/complaint.schema.ts
import { z } from "zod";
import { COMPLAINT_STATUSES } from "@/lib/constants";
import { ARCHIVE_REASON_CODES } from "@/lib/archive-policy";

export const createComplaintSchema = z.object({
  categoryRef: z.string().min(1),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  message: z.string().trim().optional(),
});

// BR-101: a student may edit their own complaint's title/description, but
// only while it's still "submitted" (not yet picked up by staff) —
// enforced in the route handler, this just shapes the input. Priority is
// deliberately NOT accepted here: it's inherited from the category
// (BR-022) and changing it is a staff/admin call, not the student's —
// zod's default "strip unknown keys" behavior means a client that sends
// one anyway just has it silently dropped, never applied. At least one
// (real) field must be present so an empty PATCH isn't a silent no-op.
export const editComplaintSchema = z
  .object({
    title: z.string().trim().min(5).max(200).optional(),
    description: z.string().trim().min(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (title or description) must be provided.",
  });

export const addNoteSchema = z.object({
  body: z.string().trim().min(1),
});

export const informationRequestSchema = z.object({
  requestMessage: z.string().trim().min(1).max(2000),
  context: z.string().trim().max(2000).optional().default(""),
});

export const informationResponseSchema = z.object({
  responseMessage: z.string().trim().min(1).max(4000),
  attachmentIds: z.array(z.string().min(1)).max(10).optional().default([]),
});

export const manualEscalationSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const rateComplaintSchema = z.object({
  studentRating: z.number().int().min(1).max(5),
  studentRatingComment: z.string().trim().optional().default(""),
});

export const reopenComplaintSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

// BR-045: administrator-only, hides a complaint from active views without
// deleting the record — never a status, so it's its own boolean rather
// than folded into updateComplaintStatusSchema.
export const archiveComplaintSchema = z.object({
  isArchived: z.boolean(),
  reason: z.string().trim().min(1).max(2000),
});

export const archiveRequestSchema = z.object({
  reasonCode: z.enum(ARCHIVE_REASON_CODES).default("other"),
  reasonText: z.string().trim().max(2000).optional().default(""),
  supportingNote: z.string().trim().max(2000).optional().default(""),
  // Keep accepting the legacy single reason field for existing clients.
  reason: z.string().trim().max(2000).optional().default(""),
}).superRefine((value, ctx) => {
  const explanation = value.reasonText || value.reason;
  if (!explanation && value.reasonCode === "other") {
    ctx.addIssue({ code: "custom", path: ["reasonText"], message: "An explanation is required for Other." });
  }
});

export const archiveDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(2000).optional().default(""),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type RateComplaintInput = z.infer<typeof rateComplaintSchema>;
export type ArchiveComplaintInput = z.infer<typeof archiveComplaintSchema>;
export type EditComplaintInput = z.infer<typeof editComplaintSchema>;
