// Mongoose model: ComplaintTimeline (collection: complaint_timeline)
// BR-053..BR-057. Append-only — kept as its own collection (not embedded
// in Complaint) since it's unbounded and would risk the 16MB document
// limit on long-lived, high-traffic tickets.
//
// BR-057 (immutability): enforced at the repository/service layer (Phase 8)
// by only ever calling `.create()` against this model and never `.update`/
// `.findOneAndUpdate`/`.deleteOne` — intentionally not a schema-level hook,
// to keep this file pure persistence/shape, no business logic.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { TIMELINE_EVENT_TYPES } from "@/lib/constants";

const complaintTimelineSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },

    // BR-056
    eventType: { type: String, enum: TIMELINE_EVENT_TYPES, required: true },
    actorRef: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = system-generated
    fromValue: { type: String, default: null },
    toValue: { type: String, default: null },
    message: { type: String, default: "" },
  },
  {
    // No updatedAt — timeline entries are immutable, one timestamp only
    timestamps: { createdAt: true, updatedAt: false },
  },
);

complaintTimelineSchema.index({ complaintRef: 1, createdAt: 1 });

export type ComplaintTimelineDocument = InferSchemaType<
  typeof complaintTimelineSchema
>;
export const ComplaintTimeline: Model<ComplaintTimelineDocument> =
  (models.ComplaintTimeline as Model<ComplaintTimelineDocument> | undefined) ??
  model<ComplaintTimelineDocument>("ComplaintTimeline", complaintTimelineSchema, "complaint_timeline");
export default ComplaintTimeline;
