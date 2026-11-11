import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const officeReturnRequestSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    requestedByUserRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    destinationOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    forwardedToRole: { type: String, enum: ["vpaa", "vpaf"], required: true },
    assignedStaffRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    complaintStatus: { type: String, required: true },
    forwardedAt: { type: Date, required: true },
    reason: { type: String, trim: true, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },
    requestedAt: { type: Date, default: Date.now, required: true },
    reviewedByUserRef: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewReason: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);

officeReturnRequestSchema.index(
  { complaintRef: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_office_return" },
);
officeReturnRequestSchema.index({ status: 1, requestedAt: -1 });
officeReturnRequestSchema.plugin(refIntegrityPlugin);

export type OfficeReturnRequestDocument = InferSchemaType<typeof officeReturnRequestSchema>;
export const OfficeReturnRequest: Model<OfficeReturnRequestDocument> =
  (models.OfficeReturnRequest as Model<OfficeReturnRequestDocument> | undefined) ??
  model<OfficeReturnRequestDocument>("OfficeReturnRequest", officeReturnRequestSchema, "office_return_requests");
