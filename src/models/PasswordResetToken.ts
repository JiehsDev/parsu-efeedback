// Mongoose model: PasswordResetToken (collection: password_reset_tokens)
//
// Not part of the original ERD/business-rules doc (BR-001..BR-100 don't
// number a password-reset rule), but required by the auth flow specified in
// docs/architecture.md section 5, step 8. Added in Phase 6, same pattern as
// the Phase 5 reconciliation additions (Assignment, GeneratedReport): a new
// collection to satisfy a behavior the blueprint already committed to.
//
// Design:
//   - Only a hash of the token is stored, never the raw value — the raw
//     token exists only in the emailed link, briefly, in memory.
//   - Single-use: `usedAt` is set the moment a reset succeeds; the service
//     layer must check `usedAt === null` before honoring a token.
//   - TTL: MongoDB's TTL index on `expiresAt` garbage-collects expired,
//     unused tokens automatically — no cron needed for cleanup.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const passwordResetTokenSchema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // SHA-256 hex digest of the raw token sent to the user's email. Never
    // store/compare the raw token server-side.
    tokenHash: { type: String, required: true, unique: true },

    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },

    // Best-effort request metadata, useful if a reset needs investigating.
    requestedIp: { type: String, default: null },
  },
  { timestamps: true },
);

passwordResetTokenSchema.plugin(refIntegrityPlugin); // BR-099

passwordResetTokenSchema.index({ userRef: 1, usedAt: 1 });
// TTL index: MongoDB deletes the document once `expiresAt` is in the past.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDocument = InferSchemaType<
  typeof passwordResetTokenSchema
>;
export const PasswordResetToken: Model<PasswordResetTokenDocument> =
  (models.PasswordResetToken as Model<PasswordResetTokenDocument> | undefined) ??
  model<PasswordResetTokenDocument>("PasswordResetToken", passwordResetTokenSchema, "password_reset_tokens");
export default PasswordResetToken;
