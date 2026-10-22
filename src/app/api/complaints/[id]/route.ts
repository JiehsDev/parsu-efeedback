import { canProcessComplaint } from "@/lib/osas-operations";
import { canAccessComplaint } from "@/lib/complaint-access";
// src/app/api/complaints/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import {
  updateComplaintStatusSchema,
  editComplaintSchema,
} from "@/features/complaints/schemas/complaint.schema";
import { isValidTransition } from "@/features/complaints/services/status-transitions.service";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import type { ComplaintStatus } from "@/lib/constants";
import {
  notifyStatusUpdated,
  notifyComplaintResolved,
} from "@/features/notifications/services/notification.service";

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

  const timeline = await ComplaintTimeline.find({ complaintRef: id })
    .sort({ createdAt: 1 })
    .populate("actorRef", "firstName lastName role employeeOrStudentId")
    .lean();

  const safeTimeline =
    session.user.role === "student"
      ? timeline
      : timeline.map((event: any) => {
          if (event.actorRef?.role !== "student") return event;
          return {
            ...event,
            actorRef: {
              _id: event.actorRef._id,
              role: "student",
              employeeOrStudentId: event.actorRef.employeeOrStudentId ?? null,
            },
          };
        });

  return NextResponse.json({ complaint, timeline: safeTimeline });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (complaint.isArchived)
    return NextResponse.json(
      { error: "Archived complaints are read-only until restored." },
      { status: 403 },
    );

  const body = await req.json();

  // BR-101: the submitting student may edit their own complaint's content
  // or withdraw it, but only while it's still "submitted" — i.e. before
  // any staff has picked it up. This is a distinct capability from the
  // staff/admin status-update flow below, not a relaxed version of it.
  if (session.user.role === "student") {
    if (String(complaint.studentRef) !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (complaint.status !== "submitted") {
      return NextResponse.json(
        {
          error:
            "This complaint has already been picked up and can no longer be edited or withdrawn.",
        },
        { status: 400 },
      );
    }

    if (body?.status === "withdrawn") {
      complaint.status = "withdrawn";
      await complaint.save();

      await ComplaintTimeline.create({
        complaintRef: complaint._id,
        eventType: "withdrawn",
        actorRef: session.user.id,
        fromValue: "submitted",
        toValue: "withdrawn",
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "complaint.withdraw",
        entityType: "Complaint",
        entityId: complaint._id,
        beforeState: { status: "submitted" },
        afterState: { status: "withdrawn" },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });

      return NextResponse.json({ complaint });
    }

    const parsedEdit = editComplaintSchema.safeParse(body);
    if (!parsedEdit.success) {
      return NextResponse.json({ error: parsedEdit.error.flatten() }, { status: 400 });
    }

    const before = {
      title: complaint.title,
      description: complaint.description,
    };
    Object.assign(complaint, parsedEdit.data);
    await complaint.save();

    await ComplaintTimeline.create({
      complaintRef: complaint._id,
      eventType: "edited",
      actorRef: session.user.id,
    });
    await writeAuditLog({
      actorId: session.user.id,
      action: "complaint.edit",
      entityType: "Complaint",
      entityId: complaint._id,
      beforeState: before,
      afterState: parsedEdit.data,
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ complaint });
  }

  if (!(await canProcessComplaint(session, complaint)))
    return NextResponse.json(
      { error: "Only the assigned OSAS handler may update this complaint." },
      { status: 403 },
    );

  const parsed = updateComplaintStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid status update.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fromStatus = complaint.status as ComplaintStatus;
  const toStatus = parsed.data.status;
  if (toStatus === "assigned") {
    return NextResponse.json(
      { error: "Use Assign Staff and select a staff member to assign this complaint." },
      { status: 400 },
    );
  }

  // Escalation has its own audited workflow. Keeping it out of the generic
  // status endpoint prevents callers from bypassing destination and history
  // rules enforced by the manual escalation routes.
  if (toStatus === "escalated") {
    return NextResponse.json(
      { error: "Use the manual escalation workflow to escalate a complaint." },
      { status: 400 },
    );
  }

  if (toStatus === "closed") {
    return NextResponse.json(
      {
        error: "Complaints are closed automatically after the student submits a resolution rating.",
      },
      { status: 400 },
    );
  }

  // pending_information has a dedicated request/response workflow. Keeping
  // it out of the generic status endpoint prevents a staff member from
  // creating a student-facing state without a request record.
  if (toStatus === "pending_information" || fromStatus === "pending_information") {
    return NextResponse.json(
      { error: "Use the information request workflow for this status." },
      { status: 400 },
    );
  }

  // BR-101: withdrawing is the submitting student's own call, made through
  // the branch above — not something staff/admin can do to someone
  // else's complaint via the generic status-update path.
  if (toStatus === "withdrawn") {
    return NextResponse.json(
      { error: "Only the submitting student can withdraw a complaint." },
      { status: 403 },
    );
  }

  if (!isValidTransition(fromStatus, toStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from '${fromStatus}' to '${toStatus}'` },
      { status: 400 },
    );
  }

  complaint.status = toStatus;
  if (toStatus === "resolved") {
    complaint.resolutionSummary = parsed.data.resolutionSummary ?? "";
    complaint.resolvedAt = new Date();
    complaint.resolvedByRef = new Types.ObjectId(session.user.id);
  }

  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType:
      fromStatus === "closed" && toStatus === "in_progress" ? "reopened" : "status_changed",
    actorRef: session.user.id,
    fromValue: fromStatus,
    toValue: toStatus,
    message: parsed.data.message ?? "",
    resolutionSummary: toStatus === "resolved" ? complaint.resolutionSummary : "",
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: toStatus === "resolved" ? "COMPLAINT_RESOLVED" : "complaint.status_change",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: { status: fromStatus },
    afterState: {
      status: toStatus,
      ...(toStatus === "resolved" ? { resolutionSummary: complaint.resolutionSummary } : {}),
    },
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
