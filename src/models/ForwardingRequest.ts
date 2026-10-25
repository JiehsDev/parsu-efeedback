import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const schema = new Schema({
  complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
  fromOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
  destinationOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true, index: true },
  requestedDestination: { type: String, enum: ["vpaa", "vpaf"], required: true },
  requestedByUserRef: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  reason: { type: String, trim: true, required: true, maxlength: 4000 },
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
  reviewReason: { type: String, default: "", maxlength: 4000 },
});
// A database constraint, not a read-before-write check, arbitrates concurrent requests.
schema.index(
  { complaintRef: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_forwarding" },
);
export type ForwardingRequestDocument = InferSchemaType<typeof schema>;
export const ForwardingRequest: Model<ForwardingRequestDocument> =
  (models.ForwardingRequest as Model<ForwardingRequestDocument> | undefined) ??
  model("ForwardingRequest", schema, "forwarding_requests");
