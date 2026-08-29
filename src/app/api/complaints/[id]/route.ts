// src/app/api/complaints/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
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

  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // BR-101: the submitting student may edit their own complaint's content
  // or withdraw it, but only while it's still "submitted" — i.e. before
  // any staff has picked it up. This is a distinct capability from the
  // staff/dean/admin status-update flow below, not a relaxed version of it.
  if (session.user.role === "student") {
    if (String(complaint.studentRef) !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (complaint.status !== "submitted") {
      return NextResponse.json(
        { error: "This complaint has already been picked up and can no longer be edited or withdrawn." },
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

  // BR-095: qa_office is read-only institution-wide — only staff/dean/admin
  // may mutate status.
  if (session.user.role === "qa_office") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateComplaintStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await canAccessComplaint(session, complaint))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fromStatus = complaint.status as ComplaintStatus;
  const toStatus = parsed.data.status;

  // BR-101: withdrawing is the submitting student's own call, made through
  // the branch above — not something staff/dean/admin can do to someone
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
