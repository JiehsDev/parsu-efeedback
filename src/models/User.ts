// Mongoose model: User (collection: users)
// BR-001..BR-013. Schema only — no business logic (password hashing,
// lockout counting, etc. happen in src/features/auth, starting Phase 6).

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { USER_ROLES } from "@/lib/constants";
import { refIntegrityPlugin } from "@/lib/mongoose-ref-integrity";

const userSchema = new Schema(
  {
    // BR-006 / BR-007: unique student number or employee ID. Stored in one
    // field since a user is exactly one of {student, employee} (BR-001) and
    // never needs both — the unique index below covers whichever it is.
    employeeOrStudentId: { type: String, required: true, unique: true, trim: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    // BR-003: unique email
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // BR-004 / BR-086: hashed only, never plaintext. Hashing happens in the
    // auth service (Phase 6) before a document is ever created/updated.
    passwordHash: { type: String, required: true },

    // BR-001: exactly one role per user
    role: { type: String, enum: USER_ROLES, required: true },

    // BR-009: staff belong to one office (a university office or a college office)
    officeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },

    // BR-008 / BR-015: student belongs to exactly one college
    collegeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },

    // BR-005: must be active to authenticate
    isActive: { type: Boolean, required: true, default: true },

    // BR-012
    lastLoginAt: { type: Date, default: null },

    // BR-013: failed-login lockout bookkeeping (thresholds are configurable —
    // see AUTH_MAX_FAILED_LOGIN_ATTEMPTS / AUTH_LOCKOUT_DURATION_MINUTES in
    // src/lib/env.ts; the counting/locking logic itself is Phase 6)
    failedLoginAttempts: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },

    // Phase 6: bumped whenever an admin needs to force-invalidate every JWT
    // already issued to this user (compromised account, role change, forced
    // logout) without waiting for natural expiry. Checked against the
    // `tokenVersion` embedded in the JWT at sign-in time — see
    // docs/architecture.md section 5 ("Why JWT, not database sessions").
    tokenVersion: { type: Number, required: true, default: 0 },

    // Phase 6: timestamp of the last completed password change/reset, for
    // auditing/support purposes. The reset token itself is never stored
    // here — see PasswordResetToken.
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, officeRef: 1 });
userSchema.index({ collegeRef: 1 });

userSchema.plugin(refIntegrityPlugin); // BR-099

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User: Model<UserDocument> =
  (models.User as Model<UserDocument> | undefined) ??
  model<UserDocument>("User", userSchema, "users");
export default User;
