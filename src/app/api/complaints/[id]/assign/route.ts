import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
import { Assignment } from "@/models/Assignment";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { assignComplaintSchema } from "@/features/complaints/schemas/assign.schema";
import { getOperationalOffice, isOsasHead, refId, isOversightRole } from "@/lib/osas-operations";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { notifyComplaintAssigned } from "@/features/notifications/services/notification.service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    isOversightRole(session.user.role) ||
    !["osas", "office_staff", "administrator"].includes(session.user.role)
  )
    return NextResponse.json(
      { error: "Oversight users cannot assign complaints." },
      { status: 403 },
    );
  await connectToDatabase();
  if (session.user.role !== "administrator" && !(await isOsasHead(session)))
    return NextResponse.json(
      { error: "Only the OSAS Head may assign complaints or Handle Personally." },
      { status: 403 },
    );
  const parsed = assignComplaintSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  if (parsed.data.action === "escalate")
    return NextResponse.json({ error: "Use internal OSAS supervisor review." }, { status: 400 });
  const office = await getOperationalOffice();
  const { id } = await params;
  const complaint = await Complaint.findById(id);
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!office || refId(complaint.assignedOfficeRef) !== refId(office._id))
    return NextResponse.json({ error: "Only OSAS complaints can be assigned." }, { status: 403 });
  if (complaint.isArchived || ["resolved", "closed", "withdrawn"].includes(complaint.status))
    return NextResponse.json({ error: "This complaint is read-only." }, { status: 403 });
  if (parsed.data.assignedOfficeRef && parsed.data.assignedOfficeRef !== refId(office._id))
    return NextResponse.json(
      { error: "Office transfers are disabled. OSAS is the only handling office." },
      { status: 400 },
    );
  const staff = await User.findById(parsed.data.assignedStaffRef).lean();
  const isHeadTarget = Boolean(staff && refId(staff._id) === refId(office.headUserRef));
  if (
    !staff ||
    !staff.isActive ||
    refId(staff.officeRef) !== refId(office._id) ||
    !(staff.role === "office_staff" || (staff.role === "osas" && isHeadTarget))
  )
    return NextResponse.json(
      { error: "Select an active OSAS staff member or the OSAS Head." },
      { status: 400 },
    );
  const changing = Boolean(
    complaint.assignedStaffRef && refId(complaint.assignedStaffRef) !== refId(staff._id),
  );
  if (changing && !parsed.data.message?.trim())
    return NextResponse.json(
      { error: "A reason is required to change assignee." },
      { status: 400 },
    );
  const before = {
    status: complaint.status,
    assignedStaffRef: complaint.assignedStaffRef,
    assignedOfficeRef: complaint.assignedOfficeRef,
  };
  complaint.assignedStaffRef = staff._id;
  complaint.supervisorReviewRequired = false;
  if (complaint.status !== "pending_information") complaint.status = "in_progress";
  await complaint.save();
  await Assignment.create({
    complaintRef: complaint._id,
    assignedByRef: session.user.id,
    assignedToRef: staff._id,
    sourceOfficeRef: office._id,
    destinationOfficeRef: office._id,
    actionType: changing ? "reassign" : "assign",
    reason: parsed.data.message ?? "",
  });
  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    actorRef: session.user.id,
    eventType: changing ? "reassigned" : "assigned",
    fromValue: before.status,
    toValue: complaint.status,
    message:
      parsed.data.message ||
      (refId(staff._id) === session.user.id
        ? "OSAS Head is handling this complaint personally."
        : "Assigned to OSAS staff. Processing started."),
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: changing ? "complaint.reassign" : "complaint.assign",
    entityType: "Complaint",
    entityId: complaint._id,
    beforeState: before,
    afterState: {
      status: complaint.status,
      assignedStaffRef: staff._id,
      assignedOfficeRef: office._id,
    },
  });
  await notifyComplaintAssigned({
    studentId: refId(complaint.studentRef),
    staffId: refId(staff._id),
    ticketNumber: complaint.ticketNumber,
    complaintId: refId(complaint._id),
  });
  return NextResponse.json({ complaint });
}
