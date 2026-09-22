import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const archiveRequestSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    requestedByRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    officeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    reasonCode: { type: String, enum: ["duplicate", "invalid", "irrelevant", "spam", "no_action_required", "addressed_elsewhere", "other"], required: true, default: "other" },
    reasonText: { type: String, required: true, trim: true },
    supportingNote: { type: String, default: "", trim: true },
    // Legacy display/storage field retained for old requests.
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], required: true, default: "pending" },
    reviewedByRef: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true },
);
archiveRequestSchema.index({ complaintRef: 1, status: 1 });
archiveRequestSchema.index({ officeRef: 1, status: 1, createdAt: -1 });
archiveRequestSchema.plugin(refIntegrityPlugin);
export type ArchiveRequestDocument = InferSchemaType<typeof archiveRequestSchema>;
export const ArchiveRequest: Model<ArchiveRequestDocument> =
  (models.ArchiveRequest as Model<ArchiveRequestDocument> | undefined) ??
  model<ArchiveRequestDocument>("ArchiveRequest", archiveRequestSchema, "archive_requests");
export default ArchiveRequest;
