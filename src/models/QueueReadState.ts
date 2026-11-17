import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listKey: { type: String, required: true },
    lastCheckedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);
schema.index({ userRef: 1, listKey: 1 }, { unique: true });

export type QueueReadStateDocument = InferSchemaType<typeof schema>;
export const QueueReadState: Model<QueueReadStateDocument> =
  (models.QueueReadState as Model<QueueReadStateDocument> | undefined) ??
  model<QueueReadStateDocument>("QueueReadState", schema, "queue_read_states");
