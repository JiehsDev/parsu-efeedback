import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { StudentEmailVerification } from "@/models/StudentEmailVerification";
import { User } from "@/models/User";
import { sendStudentEmailVerificationEmail } from "@/features/notifications/services/email.service";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_CODE_ATTEMPTS = 5;

function hashCode(userId: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`${userId}:${code}`).digest("hex");
}

export class InvalidStudentEmailCodeError extends Error {
  constructor() {
    super("The verification code is invalid or expired.");
    this.name = "InvalidStudentEmailCodeError";
  }
}

export class VerificationResendCooldownError extends Error {
  constructor() {
    super("Wait before requesting another verification code.");
    this.name = "VerificationResendCooldownError";
  }
}

export async function sendStudentEmailVerificationCode(userId: string): Promise<void> {
  await connectToDatabase();

  const user = await User.findOne({
    _id: userId,
    role: "student",
    emailVerified: false,
    isActive: true,
  }).select("email firstName lastName");
  if (!user) return;

  const now = new Date();
  const previous = await StudentEmailVerification.findOne({ userRef: user._id }).lean();
  if (previous && now.getTime() - previous.sentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new VerificationResendCooldownError();
  }

  const code = String(randomInt(100_000, 1_000_000));
  let token;
  try {
    token = await StudentEmailVerification.findOneAndUpdate(
      previous
        ? { userRef: user._id, sentAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } }
        : { userRef: user._id },
      {
        $set: {
          codeHash: hashCode(String(user._id), code),
          expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000),
          sentAt: now,
          attempts: 0,
          usedAt: null,
        },
      },
      { upsert: !previous, new: true, runValidators: true },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new VerificationResendCooldownError();
    throw error;
  }
  if (!token && previous) throw new VerificationResendCooldownError();
  if (!token) throw new Error("Could not save the student email verification code.");

  try {
    await sendStudentEmailVerificationEmail({
      to: user.email,
      recipientName: `${user.firstName} ${user.lastName}`,
      code,
    });
  } catch (error) {
    await StudentEmailVerification.updateOne(
      { _id: token._id, usedAt: null },
      { $set: { usedAt: new Date() } },
    );
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function resendStudentEmailVerificationCode(email: string): Promise<void> {
  await connectToDatabase();
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    role: "student",
    emailVerified: false,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (user) await sendStudentEmailVerificationCode(String(user._id));
}

export async function isStudentEmailVerificationInCooldown(email: string): Promise<boolean> {
  await connectToDatabase();
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    role: "student",
    emailVerified: false,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (!user) return false;

  const verification = await StudentEmailVerification.findOne({ userRef: user._id })
    .select("sentAt")
    .lean();
  return Boolean(
    verification && Date.now() - verification.sentAt.getTime() < RESEND_COOLDOWN_MS,
  );
}

export async function verifyStudentEmailCode(email: string, submittedCode: string): Promise<void> {
  await connectToDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail,
    role: "student",
    isActive: true,
  }).select("_id emailVerified");

  if (!user || user.emailVerified) throw new InvalidStudentEmailCodeError();

  const now = new Date();
  const verification = await StudentEmailVerification.findOne({
    userRef: user._id,
    usedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: MAX_CODE_ATTEMPTS },
  });
  if (!verification) throw new InvalidStudentEmailCodeError();

  const expectedHash = Buffer.from(verification.codeHash, "hex");
  const submittedHash = Buffer.from(hashCode(String(user._id), submittedCode), "hex");
  if (
    expectedHash.length !== submittedHash.length ||
    !timingSafeEqual(expectedHash, submittedHash)
  ) {
    const failedAttempt = await StudentEmailVerification.findOneAndUpdate(
      {
        _id: verification._id,
        usedAt: null,
        expiresAt: { $gt: now },
        attempts: { $lt: MAX_CODE_ATTEMPTS },
      },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (failedAttempt?.attempts === MAX_CODE_ATTEMPTS) {
      await StudentEmailVerification.updateOne(
        { _id: failedAttempt._id, usedAt: null },
        { $set: { usedAt: now } },
      );
    }
    throw new InvalidStudentEmailCodeError();
  }

  const consumed = await StudentEmailVerification.findOneAndUpdate(
    {
      _id: verification._id,
      codeHash: verification.codeHash,
      usedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: MAX_CODE_ATTEMPTS },
    },
    { $set: { usedAt: now } },
    { new: true },
  );
  if (!consumed) throw new InvalidStudentEmailCodeError();

  const result = await User.updateOne(
    { _id: user._id, role: "student", emailVerified: false, isActive: true },
    { $set: { emailVerified: true } },
  );
  if (result.modifiedCount !== 1) throw new InvalidStudentEmailCodeError();
}

export function hashVerificationRateLimitKey(ip: string, email: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${ip.trim()}:${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function hashStudentEmailRateLimitKey(email: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`email:${email.trim().toLowerCase()}`)
    .digest("hex");
}
