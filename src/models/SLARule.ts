// Mongoose model: SLARule (collection: sla_rules)
// BR-029..BR-034.
//
// Reconciled: the business rules doc talks about "one SLA configuration"
// per category (BR-029) but also requires separate response (BR-030) and
// resolution (BR-031) deadlines — this model adds responseHours alongside
// the original resolutionHours so both clocks have a source.
//
// A category's complaints always carry exactly one priority
// (Category.defaultPriority — see routing.service.ts / sla.service.ts,
// which resolve every complaint's routing and SLA rule using that single
// value, never a student- or staff-chosen one). So a category only ever
// needs a single active SLA rule, not one per priority tier — the
// {categoryRef} unique index below enforces that at the database level,
// not just in the admin UI. categoryRef nullable = institution-wide
// default, applied when a category has no active rule of its own; that
// case genuinely does need one rule per priority, since it's the fallback
// for categories at any priority — see the second index.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { PRIORITY_LEVELS } from "@/lib/constants";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

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

// BR-029: at most one active SLA rule per category — a category's fixed
// defaultPriority means it never needs more than one.
slaRuleSchema.index(
  { categoryRef: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, categoryRef: { $type: "objectId" } },
  },
);

// Institution-wide defaults (categoryRef: null) are the one case that
// legitimately varies by priority — at most one active default per
// priority level.
slaRuleSchema.index(
  { priority: 1 },
  { unique: true, partialFilterExpression: { isActive: true, categoryRef: null } },
);

slaRuleSchema.plugin(refIntegrityPlugin); // BR-099

export type SLARuleDocument = InferSchemaType<typeof slaRuleSchema>;
export const SLARule: Model<SLARuleDocument> =
  (models.SLARule as Model<SLARuleDocument> | undefined) ??
  model<SLARuleDocument>("SLARule", slaRuleSchema, "sla_rules");
export default SLARule;
