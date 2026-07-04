// Forgot/reset password flow — docs/architecture.md section 5, step 8:
//   a. generate single-use token (hashed, stored, TTL)
//   b. Resend email with reset link
//   c. verify token, bcrypt-hash new password
//
// Step (b) — actually sending the email — is stubbed here and logged
// instead. src/lib/resend.ts is explicitly a Phase 11 placeholder
// ("implemented in Phase 11 (Notifications)"); Phase 6 wires the token
// lifecycle correctly and leaves a single, obvious call site
// (`deliverPasswordResetEmail`) for Phase 11 to fill in with a real
// React Email template + Resend send.

import { randomBytes, createHash } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";
import { hashPassword } from "./password.service";

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Issues a password-reset token for the given email, if an account with
 * that email exists. Intentionally does not reveal whether the email
 * matched an account (same "don't leak account existence" principle as
 * authenticateUser) — callers should show the same success message either
 * way.
 */
export async function requestPasswordReset(
  email: string,
  requestedIp: string | null,
): Promise<void> {
  await connectToDatabase();

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.isActive) {
    // Silently no-op. The caller shows a generic "if that email exists,
    // we've sent a link" message regardless.
    return;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await PasswordResetToken.create({
    userRef: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
    requestedIp,
  });

  await deliverPasswordResetEmail(user.email, rawToken);
}

/**
 * Phase 11 replaces this body with a real Resend send using a
 * PasswordReset.tsx React Email template (see docs/architecture.md
 * section 9). For now it logs the reset link so the flow is testable
 * end-to-end in development without an email provider configured.
 */
async function deliverPasswordResetEmail(
  toEmail: string,
  rawToken: string,
): Promise<void> {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${rawToken}`;
  logger.info("Password reset link generated (email delivery is Phase 11)", {
    toEmail,
    resetUrl,
  });
}

export class InvalidOrExpiredTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or has expired.");
    this.name = "InvalidOrExpiredTokenError";
  }
}

/**
 * Consumes a single-use reset token and sets a new password. Throws if the
 * token doesn't exist, was already used, or has expired (TTL index cleans
 * up expired-and-unused rows eventually, but an in-flight request in that
 * window must still be rejected explicitly).
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  await connectToDatabase();

  const tokenHash = hashToken(rawToken);
  const resetToken = await PasswordResetToken.findOne({ tokenHash });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new InvalidOrExpiredTokenError();
  }

  const passwordHash = await hashPassword(newPassword);

  await User.updateOne(
    { _id: resetToken.userRef },
    {
      $set: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      // Force-invalidate any JWTs issued before the reset (e.g. on a
      // device an attacker had access to) — same mechanism as
      // forceLogoutUser in auth.service.ts.
      $inc: { tokenVersion: 1 },
    },
  );

  resetToken.usedAt = new Date();
  await resetToken.save();
}
