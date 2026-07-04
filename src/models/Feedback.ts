// Mongoose model: Feedback (collection: feedback)
// Standalone suggestions/feedback not tied to any specific complaint
// (distinct from a complaint's satisfaction rating, BR-067..BR-070).

import { Schema, model, models, type InferSchemaType } from "mongoose";

const feedbackSchema = new Schema(
  {
    studentRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    message: { type: String, required: true },
    isAnonymous: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

feedbackSchema.index({ studentRef: 1, createdAt: -1 });

export type FeedbackDocument = InferSchemaType<typeof feedbackSchema>;
export const Feedback =
  models.Feedback ?? model("Feedback", feedbackSchema, "feedback");
export default Feedback;
