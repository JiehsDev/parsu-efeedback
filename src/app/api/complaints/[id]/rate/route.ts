// src/app/api/complaints/[id]/rate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { closeComplaintWithRating } from "@/features/complaints/services/resolution-closure.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = rateComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await closeComplaintWithRating({
    complaintId: id,
    studentId: session.user.id,
    rating: parsed.data.studentRating,
    comment: parsed.data.studentRatingComment,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ complaint: result.complaint });
}
