import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  confirmEmailChange,
  EmailChangeError,
} from "@/features/auth/services/email-change.service";

const confirmationSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/i),
});

export async function POST(req: NextRequest) {
  const parsed = confirmationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "This email confirmation link is invalid or expired." },
      { status: 400 },
    );
  }

  try {
    await confirmEmailChange(parsed.data.token);
    return NextResponse.json({
      message: "Email address confirmed. Sign in with your new email address.",
    });
  } catch (error) {
    if (error instanceof EmailChangeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "email_in_use" ? 409 : 400 },
      );
    }
    logger.error("Email change confirmation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not confirm this email address." }, { status: 500 });
  }
}
