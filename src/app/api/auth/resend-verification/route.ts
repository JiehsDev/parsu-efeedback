import { NextRequest, NextResponse } from "next/server";
import { resendStudentEmailVerificationSchema } from "@/features/auth/schemas/student-email-verification.schema";
import {
  hashVerificationRateLimitKey,
  hashStudentEmailRateLimitKey,
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
  "If an unverified student account exists for that address, a new code will be sent.";

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
      return NextResponse.json(
        { message: "Too many code requests. Please try again later." },
        { status: 429 },
      );
    }

    await resendStudentEmailVerificationCode(parsed.data.email);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    if (error instanceof VerificationResendCooldownError) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
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
