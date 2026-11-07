import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRequestIp, profileSecurityRateLimit } from "@/lib/rate-limit";
import {
  EmailChangeError,
  requestEmailChange,
} from "@/features/auth/services/email-change.service";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  currentPassword: z.string().min(1).max(72),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await checkRateLimit(
    profileSecurityRateLimit,
    `${session.user.id}:${getRequestIp(req.headers)}`,
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many security changes. Try again later." },
      { status: 429 },
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
  }

  try {
    await requestEmailChange(session.user.id, parsed.data.email, parsed.data.currentPassword);
    return NextResponse.json({
      message:
        "Check the new email address for a confirmation link. Your current email is unchanged until confirmed.",
      pendingEmailChange: { email: parsed.data.email },
    });
  } catch (error) {
    if (error instanceof EmailChangeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "email_in_use" ? 409 : 400 },
      );
    }
    logger.error("Email change confirmation email could not be sent", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not send the confirmation email. Please try again later." },
      { status: 503 },
    );
  }
}
