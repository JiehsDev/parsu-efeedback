// Mongoose model: Feedback (collection: feedback)
// Standalone suggestions/feedback not tied to any specific complaint
// (distinct from a complaint's satisfaction rating, BR-067..BR-070).

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const feedbackSchema = new Schema(
  {
    studentRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    message: { type: String, required: true },
    isAnonymous: { type: Boolean, required: true, default: false },
    isArchived: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

feedbackSchema.plugin(refIntegrityPlugin); // BR-099

feedbackSchema.index({ studentRef: 1, isArchived: 1, createdAt: -1 });

export type FeedbackDocument = InferSchemaType<typeof feedbackSchema>;
export const Feedback: Model<FeedbackDocument> =
  (models.Feedback as Model<FeedbackDocument> | undefined) ??
  model<FeedbackDocument>("Feedback", feedbackSchema, "feedback");
export default Feedback;
