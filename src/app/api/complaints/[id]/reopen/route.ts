import { User } from "@/models/User";
import { canSuperviseComplaint } from "@/lib/osas-operations";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { reopenComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyComplaintReopened } from "@/features/notifications/services/notification.service";

async function canReopen(session: any, complaint: any) {
  return session.user.role === "administrator" || canSuperviseComplaint(session, complaint);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (complaint.isArchived)
    return NextResponse.json({ error: "Archived complaints are read-only." }, { status: 400 });
  if (!(await canReopen(session, complaint)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = reopenComplaintSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!["resolved", "closed"].includes(complaint.status)) {
    return NextResponse.json(
      { error: "Only resolved or closed complaints can be reopened." },
      { status: 400 },
    );
  }
  if (complaint.status === "closed" && session.user.role !== "administrator") {
    return NextResponse.json(
      { error: "Only an administrator can reopen a closed complaint." },
      { status: 403 },
    );
  }

  const beforeStatus = complaint.status;
  const officeId = complaint.assignedOfficeRef;
  const handler = complaint.assignedStaffRef
    ? await User.findOne({
        _id: complaint.assignedStaffRef,
        isActive: true,
        role: { $in: ["office_staff", "osas", "vpaa", "vpaf"] },
      })
    : null;
  // Reopening never sends a forwarded complaint back to OSAS.
  complaint.assignedOfficeRef = officeId;
  if (!handler) complaint.assignedStaffRef = null;
  complaint.status = handler ? "in_progress" : "submitted";
  complaint.reopenCount += 1;
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "reopened",
    actorRef: session.user.id,
    fromValue: beforeStatus,
    toValue: complaint.status,
    message: parsed.data.reason,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "COMPLAINT_REOPENED",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: beforeStatus },
    afterState: {
      status: complaint.status,
      reason: parsed.data.reason,
      reopenCount: complaint.reopenCount,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  await notifyComplaintReopened({
    studentId: String(complaint.studentRef),
    staffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
    officeId: complaint.assignedOfficeRef ? String(complaint.assignedOfficeRef) : null,
    ticketNumber: complaint.ticketNumber,
    complaintId: String(complaint._id),
  });

  return NextResponse.json({ complaint });
}
