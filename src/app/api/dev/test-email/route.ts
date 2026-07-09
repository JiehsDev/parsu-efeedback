// src/app/api/dev/test-email/route.ts
import { NextResponse } from "next/server";
import { sendComplaintSubmittedEmail } from "@/features/notifications/services/email.service";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized environment execution" }, { status: 403 });
  }

  await sendComplaintSubmittedEmail({
    to: "rabemontage@gmail.com", // use an inbox you can actually check
    recipientName: "Test User",
    ticketNumber: "PARSU-2026-000001",
    complaintId: "000000000000000000000000",
  });

  return NextResponse.json({ message: "Attempted send — check terminal + Resend dashboard" });
}
