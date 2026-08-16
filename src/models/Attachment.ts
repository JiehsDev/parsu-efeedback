// Mongoose model: Attachment (collection: attachments)
// BR-058..BR-062. Metadata only — actual files live in Cloudflare R2
// (BR-059). MIME allow-list and max size are configurable via
// UPLOAD_ALLOWED_MIME_TYPES / UPLOAD_MAX_FILE_SIZE_MB (see src/lib/env.ts);
// enforced by the upload handler (Phase 12), not this schema.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";

const attachmentSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    uploadedByRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: "uploadedAt", updatedAt: false } as const,
  },
);

attachmentSchema.index({ complaintRef: 1 });

export type AttachmentDocument = InferSchemaType<typeof attachmentSchema>;
export const Attachment: Model<AttachmentDocument> =
  (models.Attachment as Model<AttachmentDocument> | undefined) ??
  model<AttachmentDocument>("Attachment", attachmentSchema, "attachments");
export default Attachment;
