// src/app/api/complaints/[id]/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Assignment } from "@/models/Assignment";
import { assignComplaintSchema } from "@/features/complaints/schemas/assign.schema";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyComplaintAssigned } from "@/features/notifications/services/notification.service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    role,
    id: userId,
    officeRef: sessionOfficeRef,
    collegeRef: sessionCollegeRef,
  } = session.user;

  // Per BR/permission table: student and qa_office can never assign
  if (role === "student" || role === "qa_office") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  const body = await req.json();
  const parsed = assignComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // BR-101: a withdrawn complaint is inert — the student pulled it before
  // anyone acted on it, so it must never become assignable/pickable again.
  if (complaint.status === "withdrawn") {
    return NextResponse.json(
      { error: "This complaint was withdrawn by the student and cannot be assigned." },
      { status: 400 },
    );
  }

  const { assignedOfficeRef, assignedStaffRef } = parsed.data;

  // --- Scope checks per role ---

  if (role === "office_staff") {
    // Limited: can only act on complaints already in their own office,
    // and cannot move a complaint OUT of their office (that's a dean/admin
    // escalation decision, not a staff one).
    if (String(complaint.assignedOfficeRef) !== sessionOfficeRef) {
      return NextResponse.json(
        { error: "You can only manage complaints assigned to your office" },
        { status: 403 },
      );
    }
    if (assignedOfficeRef && assignedOfficeRef !== sessionOfficeRef) {
      return NextResponse.json(
        { error: "Staff cannot reassign complaints to a different office" },
        { status: 403 },
      );
    }
    // Any staff target must belong to the same office
    if (assignedStaffRef) {
      const targetStaff = await User.findById(assignedStaffRef).lean();
      if (
        !targetStaff ||
        (targetStaff as any).role !== "office_staff" ||
        String((targetStaff as any).officeRef) !== sessionOfficeRef
      ) {
        return NextResponse.json(
          { error: "Target staff must belong to your office" },
          { status: 400 },
        );
      }
    }
  }

  if (role === "college_dean") {
    // Limited: complaint's student must belong to the dean's college
    const student = await User.findById(complaint.studentRef).lean();
    if (!student || String((student as any).collegeRef) !== sessionCollegeRef) {
      return NextResponse.json(
        { error: "You can only manage complaints within your college" },
        { status: 403 },
      );
    }
    // Dean can reassign office — validate target office exists & is active
    if (assignedOfficeRef) {
      const targetOffice = await Office.findById(assignedOfficeRef).lean();
      if (!targetOffice || !(targetOffice as any).isActive) {
        return NextResponse.json(
          { error: "Target office is invalid or inactive" },
          { status: 400 },
        );
      }
    }
    // Dean can assign staff — validate target staff belongs to the
    // (new or existing) target office
    if (assignedStaffRef) {
      const effectiveOfficeRef = assignedOfficeRef ?? String(complaint.assignedOfficeRef);
      const targetStaff = await User.findById(assignedStaffRef).lean();
      if (
        !targetStaff ||
        (targetStaff as any).role !== "office_staff" ||
        String((targetStaff as any).officeRef) !== effectiveOfficeRef
      ) {
        return NextResponse.json(
          { error: "Target staff must belong to the target office" },
          { status: 400 },
        );
      }
    }
  }

  if (role === "administrator") {
    // Full access — still validate referenced documents exist
    if (assignedOfficeRef) {
      const targetOffice = await Office.findById(assignedOfficeRef).lean();
      if (!targetOffice || !(targetOffice as any).isActive) {
        return NextResponse.json(
          { error: "Target office is invalid or inactive" },
          { status: 400 },
        );
      }
    }
    if (assignedStaffRef) {
      const targetStaff = await User.findById(assignedStaffRef).lean();
      if (!targetStaff || (targetStaff as any).role !== "office_staff") {
        return NextResponse.json({ error: "Target staff is invalid" }, { status: 400 });
      }
    }
  }

  // --- Apply changes ---

  const before = {
    assignedOfficeRef: complaint.assignedOfficeRef,
    assignedStaffRef: complaint.assignedStaffRef,
    status: complaint.status,
  };

  const officeChanged =
    assignedOfficeRef !== undefined &&
    assignedOfficeRef !== String(complaint.assignedOfficeRef ?? "");

  if (assignedOfficeRef !== undefined) {
    complaint.assignedOfficeRef = assignedOfficeRef as any;
  }
  if (assignedStaffRef !== undefined) {
    complaint.assignedStaffRef = assignedStaffRef as any;
  }

  // Auto-advance status on first assignment out of "submitted"
  if (complaint.status === "submitted") {
    complaint.status = "assigned";
  }

  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: officeChanged ? "reassigned" : "assigned",
    actorRef: userId,
    fromValue: String(before.assignedOfficeRef ?? ""),
    toValue: String(complaint.assignedOfficeRef ?? ""),
    message: parsed.data.message ?? "",
  });

  // BR-047/BR-051: every assign/reassign gets its own immutable record
  // rather than mutating a prior one — this is a human action, so unlike
  // the system-routed initial record, assignedByRef is always set.
  await Assignment.create({
    complaintRef: complaint._id,
    assignedByRef: userId,
    assignedToRef: complaint.assignedStaffRef ?? null,
    sourceOfficeRef: before.assignedOfficeRef ?? null,
    destinationOfficeRef: String(complaint.assignedOfficeRef),
  });

  await writeAuditLog({
    actorId: userId,
    action: officeChanged ? "complaint.reassign" : "complaint.assign",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: before,
    afterState: {
      assignedOfficeRef: complaint.assignedOfficeRef,
      assignedStaffRef: complaint.assignedStaffRef,
      status: complaint.status,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });
  await notifyComplaintAssigned({
    studentId: String(complaint.studentRef),
    staffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
    ticketNumber: complaint.ticketNumber,
    complaintId: complaint._id.toString(),
  });

  return NextResponse.json({ complaint });
}
