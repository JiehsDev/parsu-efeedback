// Mongoose model: Office (collection: offices)
// Unified hierarchy for colleges and service offices — BR-014..BR-020.
// A "college" (BR-014/015/016) is just an Office with type: "college";
// keeping one collection avoids duplicating the same shape twice and lets
// routing/SLA rules target either kind uniformly.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { OFFICE_TYPES } from "@/lib/constants";

const officeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    type: { type: String, enum: OFFICE_TYPES, required: true },

    // BR-019: unique office code (also used for colleges)
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },

    // Optional hierarchy, e.g. a department office under a college
    parentOffice: { type: Schema.Types.ObjectId, ref: "Office", default: null },

    headUserRef: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // BR-020: inactive offices shall not receive new complaint assignments
    // (enforced by the routing engine in Phase 9 — this flag is what it reads)
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

officeSchema.index({ type: 1 });
officeSchema.index({ parentOffice: 1 });

export type OfficeDocument = InferSchemaType<typeof officeSchema>;
export const Office: Model<OfficeDocument> =
  (models.Office as Model<OfficeDocument> | undefined) ??
  model<OfficeDocument>("Office", officeSchema, "offices");

export default Office;
