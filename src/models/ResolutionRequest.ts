import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const resolutionRequestSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    requestedByRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    officeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    assignedStaffRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    complaintStatus: { type: String, required: true },
    resolutionSummary: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      required: true,
      default: "pending",
    },
    reviewedByRef: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

resolutionRequestSchema.index({ complaintRef: 1, status: 1 });
resolutionRequestSchema.index(
  { complaintRef: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
resolutionRequestSchema.index({ officeRef: 1, status: 1, createdAt: -1 });
resolutionRequestSchema.plugin(refIntegrityPlugin);

export type ResolutionRequestDocument = InferSchemaType<typeof resolutionRequestSchema>;
export const ResolutionRequest: Model<ResolutionRequestDocument> =
  (models.ResolutionRequest as Model<ResolutionRequestDocument> | undefined) ??
  model<ResolutionRequestDocument>(
    "ResolutionRequest",
    resolutionRequestSchema,
    "resolution_requests",
  );
export default ResolutionRequest;
