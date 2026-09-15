import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const informationRequestSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    requestedByRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestMessage: { type: String, required: true, trim: true },
    context: { type: String, default: "", trim: true },
    status: { type: String, enum: ["open", "responded"], required: true, default: "open" },
    requestedAt: { type: Date, required: true, default: Date.now },
    respondedAt: { type: Date, default: null },
    responseMessage: { type: String, default: "", trim: true },
    responseAttachmentRefs: [{ type: Schema.Types.ObjectId, ref: "Attachment" }],
  },
  { timestamps: true },
);

informationRequestSchema.plugin(refIntegrityPlugin);
informationRequestSchema.index({ complaintRef: 1, requestedAt: 1 });
informationRequestSchema.index({ complaintRef: 1, status: 1 });

export type InformationRequestDocument = InferSchemaType<typeof informationRequestSchema>;
export const InformationRequest: Model<InformationRequestDocument> =
  (models.InformationRequest as Model<InformationRequestDocument> | undefined) ??
  model<InformationRequestDocument>(
    "InformationRequest",
    informationRequestSchema,
    "information_requests",
  );
export default InformationRequest;
