import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Feedback } from "@/models/Feedback";
import { createFeedbackSchema } from "@/features/feedback/schemas/feedback.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = createFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await Feedback.findOne({
    _id: id,
    studentRef: session.user.id,
    isArchived: false,
  }).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const after = await Feedback.findByIdAndUpdate(id, parsed.data, {
    returnDocument: "after",
  }).lean();

  await writeAuditLog({
    actorId: session.user.id,
    action: "feedback.update",
    entityType: "Feedback",
    entityId: id,
    beforeState: {
      category: (before as any).category,
      message: (before as any).message,
      isAnonymous: (before as any).isAnonymous,
    },
    afterState: parsed.data,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ feedback: after });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const before = await Feedback.findOne({
    _id: id,
    studentRef: session.user.id,
    isArchived: false,
  }).lean();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const after = await Feedback.findByIdAndUpdate(
    id,
    { isArchived: true },
    { returnDocument: "after" },
  ).lean();

  await writeAuditLog({
    actorId: session.user.id,
    action: "feedback.archive",
    entityType: "Feedback",
    entityId: id,
    beforeState: {
      category: (before as any).category,
      isAnonymous: (before as any).isAnonymous,
    },
    afterState: { isArchived: true },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ feedback: after });
}
