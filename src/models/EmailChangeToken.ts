import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const emailChangeTokenSchema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    oldEmail: { type: String, required: true },
    newEmail: { type: String, required: true, lowercase: true, trim: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

emailChangeTokenSchema.plugin(refIntegrityPlugin);
emailChangeTokenSchema.index({ userRef: 1, usedAt: 1 });
emailChangeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailChangeTokenDocument = InferSchemaType<typeof emailChangeTokenSchema>;
export const EmailChangeToken: Model<EmailChangeTokenDocument> =
  (models.EmailChangeToken as Model<EmailChangeTokenDocument> | undefined) ??
  model<EmailChangeTokenDocument>(
    "EmailChangeToken",
    emailChangeTokenSchema,
    "email_change_tokens",
  );
