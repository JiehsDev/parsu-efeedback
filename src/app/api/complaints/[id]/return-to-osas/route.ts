import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { createOfficeReturnRequestSchema } from "@/features/complaints/schemas/office-return.schema";
import { OfficeReturnError, requestReturnToOsas } from "@/features/complaints/services/office-return.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createOfficeReturnRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const request = await requestReturnToOsas({
      session,
      complaintId: id,
      reason: parsed.data.reason,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    if (error instanceof OfficeReturnError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
