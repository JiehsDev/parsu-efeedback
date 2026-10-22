import { canProcessComplaint } from "@/lib/osas-operations";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Assignment } from "@/models/Assignment";
import { manualEscalationSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyManualEscalation } from "@/features/notifications/services/notification.service";
import { resolveManualEscalationTarget } from "@/lib/manual-escalation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!(["administrator", "office_staff", "osas"] as string[]).includes(role)) {
    return NextResponse.json({ error: "Students cannot escalate complaints." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = manualEscalationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (complaint.isArchived)
    return NextResponse.json(
      { error: "Archived complaints are read-only until restored." },
      { status: 403 },
    );
  if (["withdrawn", "resolved", "closed"].includes(complaint.status)) {
    return NextResponse.json(
      { error: "Resolved, closed, and withdrawn complaints cannot be escalated." },
      { status: 400 },
    );
  }

  if (!(await canProcessComplaint(session, complaint)))
    return NextResponse.json(
      { error: "Only the assigned OSAS handler can request supervisor review." },
      { status: 403 },
    );
  const target = await resolveManualEscalationTarget(complaint, role);
  if (!target) {
    return NextResponse.json(
      { error: "No active configured escalation authority is available for this complaint." },
      { status: 409 },
    );
  }

  const before = {
    status: complaint.status,
    assignedOfficeRef: complaint.assignedOfficeRef,
    assignedStaffRef: complaint.assignedStaffRef,
  };
  complaint.assignedOfficeRef = (target.office as any)._id;
  complaint.assignedStaffRef = (target.staff as any)._id;
  complaint.supervisorReviewRequired = true;
  if (["submitted", "assigned", "escalated"].includes(complaint.status))
    complaint.status = "in_progress";
  await complaint.save();

  await Assignment.create({
    complaintRef: complaint._id,
    assignedByRef: session.user.id,
    assignedToRef: (target.staff as any)._id,
    sourceOfficeRef: before.assignedOfficeRef ?? null,
    destinationOfficeRef: (target.office as any)._id,
    reason: parsed.data.reason,
    actionType: "manual_escalation",
  });
  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "escalated",
    actorRef: session.user.id,
    fromValue: before.status,
    toValue: complaint.status,
    message: `Manual escalation: ${parsed.data.reason}`,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "complaint.manual_escalate",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: before,
    afterState: {
      status: complaint.status,
      assignedOfficeRef: target.office._id,
      assignedStaffRef: target.staff._id,
      reason: parsed.data.reason,
      source: "manual_escalation",
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  await notifyManualEscalation({
    studentId: String(complaint.studentRef),
    staffId: String((target.staff as any)._id),
    ticketNumber: complaint.ticketNumber,
    complaintId: String(complaint._id),
    reason: parsed.data.reason,
    fromStatus: before.status,
    toStatus: complaint.status,
  });

  return NextResponse.json({ complaint, target: { office: target.office, staff: target.staff } });
}
