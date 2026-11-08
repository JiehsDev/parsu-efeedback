import { createHash, randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { EmailChangeToken } from "@/models/EmailChangeToken";
import { User } from "@/models/User";
import { verifyPassword } from "./password.service";
import {
  sendEmailChangeConfirmation,
  sendEmailChangedNotice,
} from "@/features/notifications/services/email.service";
import { parsuStudentEmailSchema } from "../schemas/register.schema";

const EMAIL_CHANGE_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class EmailChangeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_password"
      | "email_in_use"
      | "invalid_token"
      | "email_unchanged"
      | "invalid_student_email",
  ) {
    super(message);
    this.name = "EmailChangeError";
  }
}

export async function requestEmailChange(
  userId: string,
  requestedEmail: string,
  currentPassword: string,
): Promise<void> {
  await connectToDatabase();

  const user = await User.findById(userId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new EmailChangeError("Current password is incorrect.", "invalid_password");
  }

  const parsedEmail =
    user.role === "student" ? parsuStudentEmailSchema.safeParse(requestedEmail) : null;
  const newEmail = parsedEmail?.success ? parsedEmail.data : requestedEmail.trim().toLowerCase();
  if (parsedEmail && !parsedEmail.success) {
    throw new EmailChangeError(
      "Student accounts must use an email ending in @parsu.edu.ph.",
      "invalid_student_email",
    );
  }
  if (newEmail === user.email) {
    throw new EmailChangeError("Enter a different email address.", "email_unchanged");
  }
  if (await User.exists({ email: newEmail })) {
    throw new EmailChangeError("That email address is already in use.", "email_in_use");
  }

  const now = new Date();
  await EmailChangeToken.updateMany({ userRef: user._id, usedAt: null }, { $set: { usedAt: now } });

  const rawToken = randomBytes(32).toString("hex");
  const token = await EmailChangeToken.create({
    userRef: user._id,
    tokenHash: hashToken(rawToken),
    oldEmail: user.email,
    newEmail,
    expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MINUTES * 60_000),
    usedAt: null,
  });

  try {
    await sendEmailChangeConfirmation({
      to: newEmail,
      recipientName: `${user.firstName} ${user.lastName}`,
      confirmationUrl: `${env.NEXT_PUBLIC_APP_URL}/email-change/${rawToken}`,
    });
  } catch (error) {
    token.usedAt = new Date();
    await token.save();
    throw error;
  }
}

export async function getPendingEmailChange(userId: string) {
  await connectToDatabase();
  return EmailChangeToken.findOne({
    userRef: userId,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("newEmail expiresAt")
    .sort({ createdAt: -1 })
    .lean();
}

export async function confirmEmailChange(rawToken: string): Promise<{
  userId: string;
  oldEmail: string;
  newEmail: string;
}> {
  await connectToDatabase();

  const now = new Date();
  const token = await EmailChangeToken.findOneAndUpdate(
    {
      tokenHash: hashToken(rawToken),
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { returnDocument: "after" },
  );

  if (!token) {
    throw new EmailChangeError(
      "This email confirmation link is invalid or expired.",
      "invalid_token",
    );
  }

  let update;
  try {
    update = await User.updateOne(
      { _id: token.userRef, email: token.oldEmail, isActive: true },
      { $set: { email: token.newEmail }, $inc: { tokenVersion: 1 } },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new EmailChangeError("That email address is already in use.", "email_in_use");
    }
    throw error;
  }

  if (update.modifiedCount !== 1) {
    throw new EmailChangeError(
      "This email confirmation link is invalid or expired.",
      "invalid_token",
    );
  }

  const user = await User.findById(token.userRef).select("firstName lastName").lean();
  if (!user) {
    throw new Error("User disappeared after email change confirmation.");
  }

  await sendEmailChangedNotice({
    to: token.oldEmail,
    recipientName: `${user.firstName} ${user.lastName}`,
    newEmail: token.newEmail,
  });

  return {
    userId: String(token.userRef),
    oldEmail: token.oldEmail,
    newEmail: token.newEmail,
  };
}
