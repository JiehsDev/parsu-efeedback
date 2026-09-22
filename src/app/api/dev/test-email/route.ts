// src/app/api/dev/test-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendComplaintSubmittedEmail } from "@/features/notifications/services/email.service";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized environment execution" }, { status: 403 });
  }
  if (env.DEV_SEED_SECRET && req.headers.get("x-dev-seed-secret") !== env.DEV_SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await sendComplaintSubmittedEmail({
    to: "rabemontage@gmail.com", // use an inbox you can actually check
    recipientName: "Test User",
    ticketNumber: "PARSU-2026-000001",
    complaintId: "000000000000000000000000",
  });

  return NextResponse.json({ message: "Attempted send — check terminal + Resend dashboard" });
}
