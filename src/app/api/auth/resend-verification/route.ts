import { NextRequest, NextResponse } from "next/server";
import { resendStudentEmailVerificationSchema } from "@/features/auth/schemas/student-email-verification.schema";
import {
  hashVerificationRateLimitKey,
  hashStudentEmailRateLimitKey,
  isStudentEmailVerificationInCooldown,
  resendStudentEmailVerificationCode,
  VerificationResendCooldownError,
} from "@/features/auth/services/student-email-verification.service";
import {
  checkRateLimitRequired,
  getRequestIp,
  RateLimitUnavailableError,
  studentEmailVerificationResendRateLimit,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const GENERIC_MESSAGE =
  "If your registration is pending, a code has been sent. Check your inbox and spam or junk folder. Codes expire in 10 minutes; wait 60 seconds before requesting another.";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = resendStudentEmailVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ip = getRequestIp(req.headers);
  try {
    // The database cooldown is the actual-send guard. Check it before the
    // hourly request limiter so repeated clicks cannot spend resend slots
    // when no new email can be sent.
    if (await isStudentEmailVerificationInCooldown(parsed.data.email)) {
      return NextResponse.json(
        { message: GENERIC_MESSAGE },
        { headers: { "Retry-After": "60" } },
      );
    }

    const limit = await checkRateLimitRequired(
      studentEmailVerificationResendRateLimit,
      hashStudentEmailRateLimitKey(parsed.data.email),
    );
    const pairLimit = await checkRateLimitRequired(
      studentEmailVerificationResendRateLimit,
      hashVerificationRateLimitKey(ip, parsed.data.email),
    );
    const ipLimit = await checkRateLimitRequired(
      studentEmailVerificationResendRateLimit,
      hashVerificationRateLimitKey(ip, ""),
    );
    if (!limit.success || !pairLimit.success || !ipLimit.success) {
      const failedLimits = [limit, pairLimit, ipLimit].filter((result) => !result.success);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((Math.max(...failedLimits.map((result) => result.reset)) - Date.now()) / 1000),
      );
      return NextResponse.json(
        { message: `Too many code requests. Wait ${retryAfterSeconds} seconds before trying again.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    await resendStudentEmailVerificationCode(parsed.data.email);
    return NextResponse.json(
      { message: GENERIC_MESSAGE },
      { headers: { "Retry-After": "60" } },
    );
  } catch (error) {
    if (error instanceof VerificationResendCooldownError) {
      return NextResponse.json(
        { message: GENERIC_MESSAGE },
        { headers: { "Retry-After": "60" } },
      );
    }
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { error: "Code delivery is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }
    logger.error("Student verification-code resend failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Code delivery failed. Please try again later." },
      { status: 503 },
    );
  }
}
