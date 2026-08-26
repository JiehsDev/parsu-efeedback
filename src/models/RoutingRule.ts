// Mongoose model: RoutingRule (collection: routing_rules)
// BR-025..BR-028.
//
// BR-028 (must not reference inactive offices): cross-collection integrity
// check, enforced by the routing-engine service (Phase 9), not here.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const routingRuleSchema = new Schema(
  {
    // BR-025: one category maps to one office via this rule
    categoryRef: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    targetOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },

    // Small, static, bounded — embedding is fine per the blueprint's
    // embedding-vs-referencing rationale (docs/architecture.md section 3)
    conditions: {
      collegeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },
      priority: { type: String, default: null },
    },

    priority: { type: Number, required: true, default: 0 }, // rule evaluation order
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// BR-023: each category must have one active routing rule — enforced at
// the database level via a partial unique index (only among active rules,
// so deactivated/historical rules for the same category can coexist).
routingRuleSchema.index(
  { categoryRef: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

routingRuleSchema.plugin(refIntegrityPlugin); // BR-099 — categoryRef/targetOfficeRef must point at real documents

export type RoutingRuleDocument = InferSchemaType<typeof routingRuleSchema>;
export const RoutingRule: Model<RoutingRuleDocument> =
  (models.RoutingRule as Model<RoutingRuleDocument> | undefined) ??
  model<RoutingRuleDocument>("RoutingRule", routingRuleSchema, "routing_rules");
export default RoutingRule;
