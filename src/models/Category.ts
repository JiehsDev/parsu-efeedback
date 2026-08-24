// Mongoose model: Category (collection: categories)
// BR-021..BR-024.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { PRIORITY_LEVELS } from "@/lib/constants";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },

    // Mirrors of the category's routing rule / SLA rule, kept in sync by
    // cascading writes from those endpoints (see
    // src/app/api/admin/routing-rules and src/app/api/admin/sla-rules) so
    // they can be displayed without a join. defaultOfficeRef starts unset
    // until a routing rule is created for this category.
    defaultOfficeRef: { type: Schema.Types.ObjectId, ref: "Office" },
    defaultPriority: { type: String, enum: PRIORITY_LEVELS, required: true },

    // BR-024: inactive categories cannot be selected on submission
    // (enforced in the submission form/handler, Phase 8 — this is the flag it reads)
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type CategoryDocument = InferSchemaType<typeof categorySchema>;
export const Category: Model<CategoryDocument> =
  (models.Category as Model<CategoryDocument> | undefined) ??
  model<CategoryDocument>("Category", categorySchema, "categories");
export default Category;
