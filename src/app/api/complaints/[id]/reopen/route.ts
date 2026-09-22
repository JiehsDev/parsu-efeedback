import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { reopenComplaintSchema } from "@/features/complaints/schemas/complaint.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyComplaintReopened } from "@/features/notifications/services/notification.service";
import { getAdminScope, isComplaintInAdminScope } from "@/lib/admin-scope";
import { isOfficeHead } from "@/lib/archive-workflow";

async function canReopen(session: any, complaint: any) {
  if (session.user.role === "administrator") return true;
  if (session.user.role === "office_staff") {
    return Boolean(
      complaint.assignedOfficeRef &&
        String(complaint.assignedOfficeRef) === String(session.user.officeRef ?? "") &&
        (await isOfficeHead(session.user.id, complaint.assignedOfficeRef)),
    );
  }
  if (["vpaa", "vpaf", "osas"].includes(session.user.role)) {
    return isComplaintInAdminScope(getAdminScope(session.user.role), complaint);
  }
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const { id } = await params;
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  if (complaint.isArchived) return NextResponse.json({ error: "Archived complaints are read-only." }, { status: 400 });
  if (!(await canReopen(session, complaint))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = reopenComplaintSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!["resolved", "closed"].includes(complaint.status)) {
    return NextResponse.json({ error: "Only resolved or closed complaints can be reopened." }, { status: 400 });
  }
  if (complaint.status === "closed" && session.user.role !== "administrator") {
    return NextResponse.json({ error: "Only an administrator can reopen a closed complaint." }, { status: 403 });
  }

  const beforeStatus = complaint.status;
  complaint.status = "in_progress";
  complaint.reopenCount += 1;
  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "reopened",
    actorRef: session.user.id,
    fromValue: beforeStatus,
    toValue: "in_progress",
    message: parsed.data.reason,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "COMPLAINT_REOPENED",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: beforeStatus },
    afterState: { status: "in_progress", reason: parsed.data.reason, reopenCount: complaint.reopenCount },
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
