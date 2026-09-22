// src/app/api/complaints/[id]/rate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { rateComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";

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

  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (String(complaint.studentRef) !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (complaint.isArchived) {
    return NextResponse.json({ error: "Archived complaints cannot be rated." }, { status: 400 });
  }
  if (complaint.status !== "resolved") {
    return NextResponse.json({ error: "Only resolved complaints can be rated" }, { status: 400 });
  }
  if (complaint.studentRating !== null) {
    return NextResponse.json({ error: "Complaint already rated" }, { status: 409 });
  }

  complaint.studentRating = parsed.data.studentRating;
  complaint.studentRatingComment = parsed.data.studentRatingComment;
  complaint.status = "closed";
  complaint.closedAt = new Date();
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "rated",
    actorRef: session.user.id,
    toValue: String(parsed.data.studentRating),
    message: "Student submitted a satisfaction rating.",
  });

  await ComplaintTimeline.create({
    complaintRef: id,
    eventType: "closed",
    actorRef: null,
    fromValue: "resolved",
    toValue: "closed",
    message: "Complaint automatically closed after student rating.",
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.rate",
    entityType: "Complaint",
    entityId: id,
    afterState: {
      studentRating: parsed.data.studentRating,
      hasComment: Boolean(parsed.data.studentRatingComment),
      status: "closed",
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  await writeAuditLog({
    actorId: null,
    action: "COMPLAINT_CLOSED",
    entityType: "Complaint",
    entityId: id,
    beforeState: { status: "resolved" },
    afterState: { status: "closed", reason: "Student submitted resolution rating" },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ complaint });
}
