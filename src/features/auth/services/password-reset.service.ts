// src/features/auth/services/password-reset.service.ts
// Forgot/reset password flow — docs/architecture.md section 5, step 8.
// Phase 6 built the token lifecycle; this now fills in step (b) — the
// actual email send — using the Resend + React Email pipeline built in
// Phase 11, replacing the earlier log-only stub.

import { randomBytes, createHash } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";
import { hashPassword } from "./password.service";
import { sendPasswordResetEmail } from "@/features/notifications/services/email.service";

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function requestPasswordReset(
  email: string,
  requestedIp: string | null,
): Promise<void> {
  await connectToDatabase();

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.isActive) {
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

  await deliverPasswordResetEmail(user.email, `${user.firstName} ${user.lastName}`, rawToken);
}

// Phase 11: real send via Resend + React Email, replacing the earlier
// log-only stub. Falls back to logging if the send itself throws, so a
// flaky email provider never breaks the reset flow or leaks an error to
// the client (same "email failure is never fatal" rule as every other
// notification in the app).
async function deliverPasswordResetEmail(
  toEmail: string,
  recipientName: string,
  rawToken: string,
): Promise<void> {
  try {
    await sendPasswordResetEmail({ to: toEmail, recipientName, resetToken: rawToken });
  } catch (error) {
    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${rawToken}`;
    logger.error("Password reset email failed to send, logging link instead", {
      toEmail,
      resetUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export class InvalidOrExpiredTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or has expired.");
    this.name = "InvalidOrExpiredTokenError";
  }
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  await connectToDatabase();

  const tokenHash = hashToken(rawToken);
  const resetToken = await PasswordResetToken.findOne({ tokenHash });

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt.getTime() <= Date.now()) {
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
      $inc: { tokenVersion: 1 },
    },
  );

  resetToken.usedAt = new Date();
  await resetToken.save();
}
