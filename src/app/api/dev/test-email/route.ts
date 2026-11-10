import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendStudentEmailVerificationEmail } from "@/features/notifications/services/email.service";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const previewEmailTestEnabled =
    env.VERCEL_ENV === "preview" && env.DEV_EMAIL_REDIRECT_ENABLED;
  if (env.NODE_ENV === "production" && !previewEmailTestEnabled) {
    return NextResponse.json({ error: "Unauthorized environment execution" }, { status: 403 });
  }
  if (!env.DEV_SEED_SECRET || req.headers.get("x-dev-seed-secret") !== env.DEV_SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await sendStudentEmailVerificationEmail({
    to: env.RESEND_DEV_TEST_EMAIL,
    recipientName: "ParSU e-Feedback test recipient",
    code: String(randomInt(100_000, 1_000_000)),
  });

  return NextResponse.json({
    message: "Test verification email accepted by the configured provider.",
  });
}
