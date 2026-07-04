// Mongoose model: Category (collection: categories)
// BR-021..BR-024.

import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PRIORITY_LEVELS } from "@/lib/constants";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },

    // Default routing target/priority when a category is chosen; the
    // authoritative routing decision still goes through routing_rules
    // (Phase 9) — these are the fallback/defaults referenced there.
    defaultOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    defaultPriority: { type: String, enum: PRIORITY_LEVELS, required: true },

    // BR-024: inactive categories cannot be selected on submission
    // (enforced in the submission form/handler, Phase 8 — this is the flag it reads)
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type CategoryDocument = InferSchemaType<typeof categorySchema>;
export const Category =
  models.Category ?? model("Category", categorySchema, "categories");
export default Category;
