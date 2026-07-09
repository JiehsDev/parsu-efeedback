// src/models/Counter.ts
// Generic atomic counter, used for ticket number sequencing (BR-036).
// findOneAndUpdate with $inc + upsert is atomic at the MongoDB level,
// so concurrent submissions can never collide on the same number —
// unlike a findOne().sort() approach, which has a read-then-write race.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";

const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. "ticketNumber:2026"
  seq: { type: Number, required: true, default: 0 },
});

export type CounterDocument = InferSchemaType<typeof counterSchema>;
export const Counter: Model<CounterDocument> =
  (models.Counter as Model<CounterDocument> | undefined) ??
  model<CounterDocument>("Counter", counterSchema, "counters");
export default Counter;
