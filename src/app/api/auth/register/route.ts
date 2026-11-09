// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { registerSchema } from "@/features/auth/schemas/register.schema";
import {
  EmailAlreadyRegisteredError,
  InvalidCollegeError,
  InvalidStudentEmailError,
  registerStudent,
  StudentNumberAlreadyRegisteredError,
} from "@/features/auth/services/register.service";
import {
  hashVerificationRateLimitKey,
  sendStudentEmailVerificationCode,
} from "@/features/auth/services/student-email-verification.service";
import {
  checkRateLimitRequired,
  getRequestIp,
  RateLimitUnavailableError,
  registerRateLimit,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ip = getRequestIp(req.headers);
  try {
    const limit = await checkRateLimitRequired(
      registerRateLimit,
      hashVerificationRateLimitKey(ip, "registration"),
    );
    if (!limit.success) {
      return NextResponse.json(
        {
          error:
            "Too many registration attempts. If you already submitted your details, use the pending verification option to request a code. Otherwise, wait before trying again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))),
          },
        },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { error: "Registration is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }
    throw error;
  }

  let result: Awaited<ReturnType<typeof registerStudent>>;
  try {
    result = await registerStudent(parsed.data);
  } catch (error) {
    if (
      error instanceof EmailAlreadyRegisteredError ||
      error instanceof StudentNumberAlreadyRegisteredError
    ) {
      return NextResponse.json(
        { error: "An account already uses that email or student number." },
        { status: 409 },
      );
    }
    if (error instanceof InvalidCollegeError || error instanceof InvalidStudentEmailError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  await writeAuditLog({
    actorId: result.id,
    action: "auth.register_student",
    entityType: "User",
    entityId: result.id,
    afterState: {
      role: "student",
      email: parsed.data.email,
      employeeOrStudentId: parsed.data.studentNumber,
      collegeRef: parsed.data.collegeId,
      emailVerified: false,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  try {
    await sendStudentEmailVerificationCode(result.id);
  } catch {
    return NextResponse.json(
      {
        error:
          "Your account was created but the verification email could not be sent. Use Resend code to try again.",
        email: parsed.data.email,
      },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }

  return NextResponse.json(
    {
      message:
        "Verification code sent. Check your ParSU inbox and spam or junk folder. The code expires in 10 minutes.",
    },
    { status: 201 },
  );
}
