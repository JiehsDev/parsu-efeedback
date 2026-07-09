// src/features/attachments/schemas/attachment.schema.ts
import { z } from "zod";

export const presignUploadSchema = z.object({
  complaintId: z.string().min(1),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

export const createAttachmentSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
