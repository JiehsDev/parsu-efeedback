// Mongoose model: SLARule (collection: sla_rules)
// BR-029..BR-034.
//
// Reconciled: the business rules doc talks about "one SLA configuration"
// per category (BR-029) but also requires separate response (BR-030) and
// resolution (BR-031) deadlines. This model keeps the blueprint's
// per-priority granularity (a category's full "configuration" = one active
// rule per priority it supports) and adds responseHours alongside the
// original resolutionHours so both clocks have a source. categoryRef
// nullable = institution-wide default, applied when no category-specific
// active rule matches.

import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PRIORITY_LEVELS } from "@/lib/constants";

const slaRuleSchema = new Schema(
  {
    categoryRef: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    priority: { type: String, enum: PRIORITY_LEVELS, required: true },

    // BR-030: first-response deadline
    responseHours: { type: Number, required: true },
    // BR-031: resolution deadline
    resolutionHours: { type: Number, required: true },

    // BR-033: escalation target once resolutionHours is breached
    warningThresholdPercent: { type: Number, required: true, default: 80 },
    escalateToOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },

    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// BR-029: one active SLA configuration per category+priority combination
// (categoryRef: null groups institution-wide defaults the same way)
slaRuleSchema.index(
  { categoryRef: 1, priority: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export type SLARuleDocument = InferSchemaType<typeof slaRuleSchema>;
export const SLARule = models.SLARule ?? model("SLARule", slaRuleSchema, "sla_rules");
export default SLARule;
