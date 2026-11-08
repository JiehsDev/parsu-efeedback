import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendStudentEmailVerificationEmail } from "@/features/notifications/services/email.service";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized environment execution" }, { status: 403 });
  }
  if (!env.DEV_SEED_SECRET || req.headers.get("x-dev-seed-secret") !== env.DEV_SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!env.DEV_TEST_EMAIL_RECIPIENT) {
    return NextResponse.json(
      { error: "Configure DEV_TEST_EMAIL_RECIPIENT before sending a test email." },
      { status: 503 },
    );
  }

  await sendStudentEmailVerificationEmail({
    to: env.DEV_TEST_EMAIL_RECIPIENT,
    recipientName: "ParSU e-Feedback test recipient",
    code: String(randomInt(100_000, 1_000_000)),
  });

  return NextResponse.json({
    message: "Test verification email accepted by the configured provider.",
  });
}
