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
import {
  notifyComplaintAssigned,
  notifyComplaintRoutedToOffice,
  notifyStatusUpdated,
} from "@/features/notifications/services/notification.service";
import {
  getOsasAllowedDestinationOffices,
  getOsasEscalationOffice,
  isComplaintInOsasActionScope,
} from "@/lib/osas-complaint-scope";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, id: userId, officeRef: sessionOfficeRef } = session.user;

  // Explicit allow-list (not a deny-list) so a new role added to
  // USER_ROLES without an assign-scope branch here fails closed rather
  // than falling through to the unguarded "apply changes" section below —
  // osas in particular has no complaint-assignment authority at all.
  if (!["office_staff", "vpaa", "vpaf", "osas", "administrator"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
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

  const { assignedOfficeRef, assignedStaffRef, action } = parsed.data;
  const isEscalationAction = action === "escalate";

  // --- Scope checks per role ---

  if (role === "office_staff") {
    // Limited: can only act on complaints already in their own office,
    // and cannot move a complaint OUT of their office (that's a
    // VPAA/VPAF/admin escalation decision, not a staff one).
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

  if (role === "vpaa" || role === "vpaf") {
    // Broad, like admin, but confined to one office category: vpaa may only
    // touch complaints currently sitting in a college_office, vpaf only in
    // a university_office. College/dean handling is represented through
    // college offices and their head users, not a separate software role.
    const requiredType = role === "vpaa" ? "college_office" : "university_office";

    const currentOffice = await Office.findById(complaint.assignedOfficeRef).lean();
    if (!currentOffice || (currentOffice as any).type !== requiredType) {
      return NextResponse.json(
        { error: "You can only manage complaints within your office category" },
        { status: 403 },
      );
    }
    // May reassign — validate target office exists, is active, and stays
    // within the same office category.
    if (assignedOfficeRef) {
      const targetOffice = await Office.findById(assignedOfficeRef).lean();
      if (
        !targetOffice ||
        !(targetOffice as any).isActive ||
        (targetOffice as any).type !== requiredType
      ) {
        return NextResponse.json(
          { error: "Target office is invalid, inactive, or outside your office category" },
          { status: 400 },
        );
      }
    }
    // May assign staff — validate target staff belongs to the (new or
    // existing) target office.
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

  if (role === "osas") {
    if (!(await isComplaintInOsasActionScope(complaint))) {
      return NextResponse.json(
        { error: "OSAS can only reassign complaints within student-affairs scope" },
        { status: 403 },
      );
    }

    const allowedDestinations = await getOsasAllowedDestinationOffices(complaint);
    const allowedDestinationIds = new Set(allowedDestinations.map((office: any) => String(office._id)));
    const effectiveOfficeRef = assignedOfficeRef ?? String(complaint.assignedOfficeRef ?? "");
    if (!effectiveOfficeRef || !allowedDestinationIds.has(effectiveOfficeRef)) {
      return NextResponse.json(
        { error: "Destination office is outside OSAS reassignment scope" },
        { status: 400 },
      );
    }

    const targetOffice = await Office.findById(effectiveOfficeRef).lean();
    if (!targetOffice || !(targetOffice as any).isActive) {
      return NextResponse.json({ error: "Target office is invalid or inactive" }, { status: 400 });
    }

    if (isEscalationAction) {
      const escalationOffice = await getOsasEscalationOffice(complaint);
      if (!escalationOffice || String((escalationOffice as any)._id) !== effectiveOfficeRef) {
        return NextResponse.json(
          { error: "OSAS escalation must use the configured VPAA/escalation destination" },
          { status: 400 },
        );
      }
    }

    if (assignedStaffRef) {
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

  if (isEscalationAction) {
    complaint.status = "escalated";
  }

  // Auto-advance status on first assignment out of "submitted"
  if (!isEscalationAction && complaint.status === "submitted") {
    complaint.status = "assigned";
  }

  await complaint.save();

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: isEscalationAction ? "escalated" : officeChanged ? "reassigned" : "assigned",
    actorRef: userId,
    fromValue: isEscalationAction ? before.status : String(before.assignedOfficeRef ?? ""),
    toValue: isEscalationAction ? "escalated" : String(complaint.assignedOfficeRef ?? ""),
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
    action:
      role === "osas" && isEscalationAction
        ? "OSAS_COMPLAINT_ESCALATED"
        : role === "osas"
          ? "OSAS_COMPLAINT_REASSIGNED"
          : officeChanged
            ? "complaint.reassign"
            : "complaint.assign",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: before,
    afterState: {
      assignedOfficeRef: complaint.assignedOfficeRef,
      assignedStaffRef: complaint.assignedStaffRef,
      status: complaint.status,
      reason: parsed.data.message ?? "",
      escalatedAt: isEscalationAction ? new Date() : undefined,
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
  if (officeChanged && complaint.assignedOfficeRef) {
    await notifyComplaintRoutedToOffice({
      officeId: String(complaint.assignedOfficeRef),
      ticketNumber: complaint.ticketNumber,
      complaintId: complaint._id.toString(),
    });
  }
  if (isEscalationAction) {
    await notifyStatusUpdated({
      studentId: String(complaint.studentRef),
      ticketNumber: complaint.ticketNumber,
      complaintId: complaint._id.toString(),
      fromStatus: before.status,
      toStatus: "escalated",
    });
  }

  return NextResponse.json({ complaint });
}
