// src/app/api/complaints/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { updateComplaintStatusSchema } from "@/features/complaints/schemas/complaint.schema";
import { isValidTransition } from "@/features/complaints/services/status-transitions.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import type { ComplaintStatus } from "@/lib/constants";
import {
  notifyStatusUpdated,
  notifyComplaintResolved,
} from "@/features/notifications/services/notification.service";
async function canAccessComplaint(session: any, complaint: any): Promise<boolean> {
  const { role, id, officeRef, collegeRef } = session.user;
  if (role === "administrator" || role === "qa_office") return true;
  if (role === "student") return String(complaint.studentRef) === id;
  if (role === "office_staff") return String(complaint.assignedOfficeRef) === officeRef;
  if (role === "college_dean") {
    const student = await User.findById(complaint.studentRef).lean();
    return String((student as any)?.collegeRef) === collegeRef;
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timeline = await ComplaintTimeline.find({ complaintRef: id }).sort({ createdAt: 1 }).lean();

  return NextResponse.json({ complaint, timeline });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Students never change status directly, and BR-095 makes qa_office
  // read-only institution-wide — only staff/dean/admin may mutate status.
  if (session.user.role === "student" || session.user.role === "qa_office") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateComplaintStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fromStatus = complaint.status as ComplaintStatus;
  const toStatus = parsed.data.status;

  if (!isValidTransition(fromStatus, toStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from '${fromStatus}' to '${toStatus}'` },
      { status: 400 },
    );
  }

  complaint.status = toStatus;
  if (toStatus === "resolved") complaint.resolvedAt = new Date();
  if (toStatus === "closed") complaint.closedAt = new Date();
  if (fromStatus === "closed" && toStatus === "in_progress") {
    complaint.reopenCount += 1;
  }

  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "status_changed",
    actorRef: session.user.id,
    fromValue: fromStatus,
    toValue: toStatus,
    message: parsed.data.message ?? "",
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.status_change",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: fromStatus },
    afterState: { status: toStatus },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  if (toStatus === "resolved") {
    await notifyComplaintResolved({
      studentId: String(complaint.studentRef),
      ticketNumber: complaint.ticketNumber,
      complaintId: complaint._id.toString(),
    });
  } else {
    await notifyStatusUpdated({
      studentId: String(complaint.studentRef),
      ticketNumber: complaint.ticketNumber,
      complaintId: complaint._id.toString(),
      fromStatus,
      toStatus,
    });
  }
  return NextResponse.json({ complaint });
}
