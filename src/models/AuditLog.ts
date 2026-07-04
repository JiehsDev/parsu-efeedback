// Mongoose model: AuditLog (collection: audit_logs)
// BR-075..BR-077. Immutable, insert-only — enforced at the repository
// layer (Phase 8+, every mutating handler writes one entry) by never
// calling update/delete against this model. Not a schema-level hook, to
// keep this file pure persistence/shape.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorRef: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = system action
    action: { type: String, required: true }, // free-form, e.g. "complaint.status_changed"
    entityType: { type: String, required: true }, // e.g. "Complaint"
    entityId: { type: Schema.Types.ObjectId, required: true },

    // Small, bounded snapshots — embedding is appropriate here (see
    // docs/architecture.md section 3 embedding rationale)
    beforeState: { type: Schema.Types.Mixed, default: null },
    afterState: { type: Schema.Types.Mixed, default: null },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ actorRef: 1, createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;
export const AuditLog: Model<AuditLogDocument> =
  (models.AuditLog as Model<AuditLogDocument> | undefined) ??
  model<AuditLogDocument>("AuditLog", auditLogSchema, "audit_logs");
export default AuditLog;
