import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const dismissalRequestSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    requestedByRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    officeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    assignedStaffRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    complaintStatus: { type: String, required: true },
    reasonCode: { type: String, required: true },
    reasonText: { type: String, required: true, trim: true },
    internalNote: { type: String, default: "", trim: true },
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

dismissalRequestSchema.index(
  { complaintRef: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
dismissalRequestSchema.index({ officeRef: 1, status: 1, createdAt: -1 });
dismissalRequestSchema.plugin(refIntegrityPlugin);

export type DismissalRequestDocument = InferSchemaType<typeof dismissalRequestSchema>;
export const DismissalRequest: Model<DismissalRequestDocument> =
  (models.DismissalRequest as Model<DismissalRequestDocument> | undefined) ??
  model<DismissalRequestDocument>("DismissalRequest", dismissalRequestSchema, "dismissal_requests");
