// src/app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Feedback } from "@/models/Feedback";
import { createFeedbackSchema } from "@/features/feedback/schemas/feedback.schema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await req.json();
  const parsed = createFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const feedback = await Feedback.create({
    studentRef: session.user.id,
    ...parsed.data,
  });

  return NextResponse.json({ feedback }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const feedback = await Feedback.find({ studentRef: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ feedback });
}
