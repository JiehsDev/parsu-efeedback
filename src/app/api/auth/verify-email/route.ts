import { NextRequest, NextResponse } from "next/server";
import { verifyStudentEmailSchema } from "@/features/auth/schemas/student-email-verification.schema";
import {
  hashVerificationRateLimitKey,
  hashStudentEmailRateLimitKey,
  InvalidStudentEmailCodeError,
  verifyStudentEmailCode,
} from "@/features/auth/services/student-email-verification.service";
import {
  checkRateLimitRequired,
  getRequestIp,
  RateLimitUnavailableError,
  studentEmailVerificationRateLimit,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = verifyStudentEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ip = getRequestIp(req.headers);
  try {
    const limit = await checkRateLimitRequired(
      studentEmailVerificationRateLimit,
      hashStudentEmailRateLimitKey(parsed.data.email),
    );
    const pairLimit = await checkRateLimitRequired(
      studentEmailVerificationRateLimit,
      hashVerificationRateLimitKey(ip, parsed.data.email),
    );
    const ipLimit = await checkRateLimitRequired(
      studentEmailVerificationRateLimit,
      hashVerificationRateLimitKey(ip, ""),
    );
    if (!limit.success || !pairLimit.success || !ipLimit.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Request a new code and try later." },
        { status: 429 },
      );
    }
    await verifyStudentEmailCode(parsed.data.email, parsed.data.code);
    return NextResponse.json({ message: "Email verified. You can now sign in." });
  } catch (error) {
    if (error instanceof InvalidStudentEmailCodeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { error: "Verification is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }
    throw error;
  }
}
