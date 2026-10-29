// Mongoose model: Category (collection: categories)
// BR-021..BR-024.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { CATEGORY_GROUPS } from "@/lib/category-groups";
import { PRIORITY_LEVELS } from "@/lib/constants";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    domain: {
      type: String,
      enum: [
        "academic",
        "administrative",
        "finance",
        "facilities",
        "student_services",
        "ict",
        "health",
        "other",
      ],
      default: "other",
    },
    description: { type: String, default: "" },

    // Classification only; never used by intake, forwarding, or access control.
    group: { type: String, enum: CATEGORY_GROUPS, default: null },

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

categorySchema.plugin(refIntegrityPlugin); // BR-099

export type CategoryDocument = InferSchemaType<typeof categorySchema>;
export const Category: Model<CategoryDocument> =
  (models.Category as Model<CategoryDocument> | undefined) ??
  model<CategoryDocument>("Category", categorySchema, "categories");
export default Category;
