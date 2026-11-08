import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const studentEmailVerificationSchema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studentEmailVerificationSchema.plugin(refIntegrityPlugin);
studentEmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type StudentEmailVerificationDocument = InferSchemaType<
  typeof studentEmailVerificationSchema
>;
export const StudentEmailVerification: Model<StudentEmailVerificationDocument> =
  (models.StudentEmailVerification as Model<StudentEmailVerificationDocument> | undefined) ??
  model<StudentEmailVerificationDocument>(
    "StudentEmailVerification",
    studentEmailVerificationSchema,
    "student_email_verifications",
  );
