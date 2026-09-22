// src/app/api/complaints/[id]/reassign-office/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { reassignOfficeSchema } from "@/features/complaints/schemas/complaint.schema";
import { reassignOffice } from "@/features/complaints/services/office-reassignment.service";

const ALLOWED_ROLES = new Set(["office_staff", "vpaa", "vpaf", "osas", "administrator"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const parsed = reassignOfficeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reason =
    parsed.data.reasonCode === "other"
      ? parsed.data.reasonText
      : `${parsed.data.reasonCode}: ${parsed.data.reasonText || parsed.data.reasonCode}`;

  const result = await reassignOffice({
    complaintId: id,
    actorId: session.user.id,
    actorRole: session.user.role,
    destinationOfficeId: parsed.data.destinationOfficeRef,
    reason,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ complaint: result.complaint });
}
