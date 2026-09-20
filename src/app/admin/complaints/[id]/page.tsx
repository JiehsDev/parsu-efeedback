// src/app/admin/complaints/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Flag,
  GraduationCap,
  Hash,
  History,
  User as UserIcon,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ComplaintNote } from "@/models/ComplaintNote";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { AssignmentDialog } from "@/components/shared/AssignmentDialog";
import { AssignmentHistoryPanel } from "@/components/shared/AssignmentHistoryPanel";
import { NotesSection } from "@/components/shared/NotesSection";
import { AttachmentGallery } from "@/components/shared/AttachmentGallery";
import { CopyButton } from "@/components/shared/CopyButton";
import { ArchiveComplaintToggle } from "@/components/admin/ArchiveComplaintToggle";
import { StatusUpdateForm } from "@/components/staff/StatusUpdateForm";
import type { ComplaintStatus } from "@/lib/constants";
import { getAdminScope, officeFilterForScope } from "@/lib/admin-scope";
import { getAssignmentHistoryEntries } from "@/lib/assignment-history";
import { InformationRequest } from "@/models/InformationRequest";
import { InformationRequestPanel } from "@/components/staff/InformationRequestPanel";
import {
  getOsasAllowedDestinationOffices,
  getOsasEscalationOffice,
  isComplaintInOsasActionScope,
} from "@/lib/osas-complaint-scope";
import { resolveManualEscalationTarget } from "@/lib/manual-escalation";
import { SlaDetails } from "@/components/shared/SlaDetails";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connectToDatabase();
  const session = await auth();
  const role = session!.user.role;
  const scope = getAdminScope(role);
  const isAdmin = role === "administrator";
  const { id } = await params;

  // No isArchived filter here, unlike every role-scoped complaint page —
  // an admin has to be able to open an already-archived complaint in order
  // to restore it (see ArchiveComplaintToggle below).
  const complaint = await Complaint.findById(id).lean();
  if (!complaint) notFound();

  const c = complaint as any;

  const [
    student,
    office,
    timeline,
    notes,
    assignedStaff,
    activeOffices,
    assignmentHistory,
    osasCanAssign,
    osasEscalationOffice,
    informationRequests,
    escalationTarget,
  ] = await Promise.all([
    // Student identity is kept out of the admin view — ID + college only,
    // not name, so a complaint reads a little more anonymous.
    User.findById(c.studentRef)
      .select("employeeOrStudentId collegeRef")
      .populate("collegeRef", "name")
      .lean(),
    c.assignedOfficeRef ? Office.findById(c.assignedOfficeRef).lean() : null,
    ComplaintTimeline.find({ complaintRef: id })
      .sort({ createdAt: 1 })
      .populate("actorRef", "firstName lastName role")
      .lean(),
    ComplaintNote.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
    c.assignedStaffRef
      ? User.findById(c.assignedStaffRef).select("firstName lastName").lean()
      : null,
    role === "osas"
      ? getOsasAllowedDestinationOffices(c)
      : scope.kind === "student"
        ? []
        : Office.find({ ...officeFilterForScope(scope), isActive: true })
            .select("name type")
            .sort({ name: 1 })
            .lean(),
    getAssignmentHistoryEntries(id),
    role === "osas" ? isComplaintInOsasActionScope(c) : false,
    role === "osas" ? getOsasEscalationOffice(c) : null,
    InformationRequest.find({ complaintRef: id }).sort({ requestedAt: -1 }).lean(),
    resolveManualEscalationTarget(c, role),
  ]);

  // vpaa/vpaf are confined to complaints assigned to their office
  // category; osas and administrator see every complaint.
  if (
    (scope.kind === "college_office" || scope.kind === "university_office") &&
    (office as any)?.type !== scope.kind
  ) {
    notFound();
  }
  const firstResponseAt = assignmentHistory.find((entry) => entry.assignedByName)?.createdAt ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to complaints
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-1 font-mono text-xs text-[var(--muted-foreground)]">
            {c.ticketNumber}
            <CopyButton value={c.ticketNumber} />
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              {c.title}
            </h1>
            <StatusBadge status={c.status as ComplaintStatus} />
            {c.isArchived && (
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                Archived
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <ArchiveComplaintToggle
            complaintId={String(c._id)}
            ticketNumber={c.ticketNumber}
            isArchived={c.isArchived}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <SlaDetails complaint={c} firstResponseAt={firstResponseAt} events={timeline as any} />
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
            <p className="text-sm font-semibold text-[var(--foreground)]">Description</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--foreground)]/90">
              {c.description}
            </p>
          </div>

          <AttachmentGallery complaintId={String(c._id)} />

          <NotesSection
            complaintId={String(c._id)}
            initialNotes={JSON.parse(JSON.stringify(notes))}
            readOnly
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Details</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Flag className="h-3.5 w-3.5" />
                  Priority
                </dt>
                <dd className="mt-1.5 flex items-center gap-1.5 text-[var(--foreground)] capitalize">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[c.priority] ?? "bg-[var(--muted-foreground)]"}`}
                  />
                  {c.priority}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <UserIcon className="h-3.5 w-3.5" />
                  Complainant
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {student ? ((student as any).employeeOrStudentId ?? "—") : "—"}
                </dd>
                <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  {student ? ((student as any).collegeRef?.name ?? "—") : "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Building2 className="h-3.5 w-3.5" />
                  Office
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {office ? (office as any).name : "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Hash className="h-3.5 w-3.5" />
                  Ticket
                </dt>
                <dd className="mt-1.5 font-mono text-xs text-[var(--foreground)]">
                  {c.ticketNumber}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Calendar className="h-3.5 w-3.5" />
                  Submitted
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {new Date(c.submittedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {isAdmin && <StatusUpdateForm complaintId={String(c._id)} currentStatus={c.status} />}

          {(isAdmin ||
            role === "vpaa" ||
            role === "vpaf" ||
            osasCanAssign ||
            c.status === "pending_information") && (
            <InformationRequestPanel
              complaintId={String(c._id)}
              status={c.status}
              canRequest={isAdmin || role === "vpaa" || role === "vpaf" || osasCanAssign}
              requests={JSON.parse(JSON.stringify(informationRequests))}
            />
          )}

          {["administrator", "vpaa", "vpaf"].includes(role) && c.status !== "withdrawn" && (
            <AssignmentDialog
              complaintId={String(c._id)}
              currentOfficeId={c.assignedOfficeRef ? String(c.assignedOfficeRef) : null}
              currentOfficeName={office ? (office as any).name : null}
              currentStaffId={c.assignedStaffRef ? String(c.assignedStaffRef) : null}
              currentStaffName={
                assignedStaff
                  ? `${(assignedStaff as any).firstName} ${(assignedStaff as any).lastName}`
                  : null
              }
              offices={(activeOffices as any[]).map((activeOffice) => ({
                _id: String(activeOffice._id),
                name: activeOffice.name,
                type: activeOffice.type,
              }))}
              canChangeOffice
            />
          )}

          {role === "osas" && osasCanAssign && c.status !== "withdrawn" && (
            <>
              <AssignmentDialog
                complaintId={String(c._id)}
                currentOfficeId={c.assignedOfficeRef ? String(c.assignedOfficeRef) : null}
                currentOfficeName={office ? (office as any).name : null}
                currentStaffId={c.assignedStaffRef ? String(c.assignedStaffRef) : null}
                currentStaffName={
                  assignedStaff
                    ? `${(assignedStaff as any).firstName} ${(assignedStaff as any).lastName}`
                    : null
                }
                offices={(activeOffices as any[]).map((activeOffice) => ({
                  _id: String(activeOffice._id),
                  name: activeOffice.name,
                  type: activeOffice.type,
                }))}
                canChangeOffice
                label="Reassign Complaint"
                action="reassign"
              />
              {osasEscalationOffice && (
                <AssignmentDialog
                  complaintId={String(c._id)}
                  currentOfficeId={c.assignedOfficeRef ? String(c.assignedOfficeRef) : null}
                  currentOfficeName={office ? (office as any).name : null}
                  currentStaffId={c.assignedStaffRef ? String(c.assignedStaffRef) : null}
                  currentStaffName={
                    assignedStaff
                      ? `${(assignedStaff as any).firstName} ${(assignedStaff as any).lastName}`
                      : null
                  }
                  offices={[
                    {
                      _id: String((osasEscalationOffice as any)._id),
                      name: (osasEscalationOffice as any).name,
                      type: (osasEscalationOffice as any).type,
                    },
                  ]}
                  canChangeOffice
                  label="Escalate Complaint"
                  action="escalate"
                  destinationOfficeId={String(
                    escalationTarget?.office?._id ?? osasEscalationOffice._id,
                  )}
                  destinationStaffId={escalationTarget ? String(escalationTarget.staff._id) : null}
                />
              )}
            </>
          )}

          {role !== "osas" &&
            ["administrator", "vpaa", "vpaf"].includes(role) &&
            escalationTarget &&
            c.status !== "withdrawn" && (
              <AssignmentDialog
                complaintId={String(c._id)}
                currentOfficeId={c.assignedOfficeRef ? String(c.assignedOfficeRef) : null}
                currentOfficeName={office ? (office as any).name : null}
                currentStaffId={c.assignedStaffRef ? String(c.assignedStaffRef) : null}
                currentStaffName={
                  assignedStaff
                    ? `${(assignedStaff as any).firstName} ${(assignedStaff as any).lastName}`
                    : null
                }
                offices={[
                  {
                    _id: String(escalationTarget.office._id),
                    name: escalationTarget.office.name,
                    type: escalationTarget.office.type,
                  },
                ]}
                canChangeOffice
                label="Escalate Complaint"
                action="escalate"
                destinationOfficeId={String(escalationTarget.office._id)}
                destinationStaffId={String(escalationTarget.staff._id)}
              />
            )}

          <AssignmentHistoryPanel entries={assignmentHistory} />

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--muted-foreground)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">Timeline</p>
            </div>
            <div className="mt-4">
              {timeline.map((event: any) => (
                <TimelineEvent key={event._id} event={event} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
