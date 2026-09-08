// Mongoose model: Office (collection: offices)
// Unified hierarchy for college offices and university offices —
// BR-014..BR-020. A "college office" (BR-014/015/016, e.g. CBM/CECS/COED)
// is just an Office with type: "college_office"; a "university office"
// (e.g. Registrar, Cashier) is type: "university_office". Keeping one
// collection avoids duplicating the same shape twice and lets
// routing/SLA rules and staff assignment target either kind uniformly.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { OFFICE_TYPES } from "@/lib/constants";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

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

officeSchema.plugin(refIntegrityPlugin); // BR-099

export type OfficeDocument = InferSchemaType<typeof officeSchema>;
export const Office: Model<OfficeDocument> =
  (models.Office as Model<OfficeDocument> | undefined) ??
  model<OfficeDocument>("Office", officeSchema, "offices");

export default Office;
