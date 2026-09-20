// src/app/staff/complaints/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Flag,
  GraduationCap,
  Hash,
  History,
  User as UserIcon,
  UserX,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ComplaintNote } from "@/models/ComplaintNote";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { AssignmentDialog } from "@/components/shared/AssignmentDialog";
import { AssignmentHistoryPanel } from "@/components/shared/AssignmentHistoryPanel";
import { StatusUpdateForm } from "@/components/staff/StatusUpdateForm";
import { NotesSection } from "@/components/shared/NotesSection";
import { AssignSelfButton } from "@/components/staff/AssignSelfButton";
import type { ComplaintStatus } from "@/lib/constants";
import { AttachmentGallery } from "@/components/shared/AttachmentGallery";
import { CopyButton } from "@/components/shared/CopyButton";
import { getAssignmentHistoryEntries } from "@/lib/assignment-history";
import { InformationRequest } from "@/models/InformationRequest";
import { InformationRequestPanel } from "@/components/staff/InformationRequestPanel";
import { resolveManualEscalationTarget } from "@/lib/manual-escalation";
import { SlaDetails } from "@/components/shared/SlaDetails";

export const dynamic = "force-dynamic";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function StaffComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id)
    .read("primary")
    .populate({
      // Student identity is kept out of the staff view — ID + college
      // only, not name, so a complaint reads a little more anonymous.
      path: "studentRef",
      select: "employeeOrStudentId collegeRef",
      populate: { path: "collegeRef", select: "name" },
    })
    .lean();
  if (!complaint || String((complaint as any).assignedOfficeRef) !== session!.user.officeRef) {
    notFound();
  }

  const c = complaint as any;

  const [
    timeline,
    notes,
    office,
    assignedStaff,
    assignmentHistory,
    informationRequests,
    escalationTarget,
  ] = await Promise.all([
    ComplaintTimeline.find({ complaintRef: id })
      .sort({ createdAt: 1 })
      .populate("actorRef", "firstName lastName role")
      .lean(),
    ComplaintNote.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
    Office.findById(session!.user.officeRef).select("name type").lean(),
    c.assignedStaffRef
      ? User.findById(c.assignedStaffRef).select("firstName lastName").lean()
      : null,
    getAssignmentHistoryEntries(id),
    InformationRequest.find({ complaintRef: id }).sort({ requestedAt: -1 }).lean(),
    String(c.assignedStaffRef ?? "") === session!.user.id
      ? resolveManualEscalationTarget(c, session!.user.role)
      : null,
  ]);
  const currentOfficeName = office ? (office as any).name : "Your office";
  const currentStaffName = assignedStaff
    ? `${(assignedStaff as any).firstName} ${(assignedStaff as any).lastName}`
    : null;
  const firstResponseAt = assignmentHistory.find((entry) => entry.assignedByName)?.createdAt ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/staff/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1 font-mono text-xs text-[var(--muted-foreground)]">
            {c.ticketNumber}
            <CopyButton value={c.ticketNumber} />
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {c.title}
          </h1>
        </div>
        <div className="shrink-0 lg:hidden">
          <StatusBadge status={c.status as ComplaintStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <SlaDetails complaint={c} firstResponseAt={firstResponseAt} events={timeline as any} />
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
            <p className="text-sm font-semibold text-[var(--foreground)]">Description</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--foreground)]/90">
              {c.description}
            </p>

            {!c.assignedStaffRef && (
              <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                <UserX className="h-4 w-4 shrink-0" />
                Nobody has picked this up yet.
              </div>
            )}
          </div>

          <AttachmentGallery complaintId={String(c._id)} />

          <NotesSection
            complaintId={String(c._id)}
            initialNotes={JSON.parse(JSON.stringify(notes))}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Details</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="hidden lg:block">
                <dt className="text-xs text-[var(--muted-foreground)]">Status</dt>
                <dd className="mt-1.5">
                  <StatusBadge status={c.status as ComplaintStatus} />
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <UserIcon className="h-3.5 w-3.5" />
                  Complainant
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {c.studentRef?.employeeOrStudentId ?? "—"}
                </dd>
                <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  {c.studentRef?.collegeRef?.name ?? "—"}
                </dd>
              </div>
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

          {/* BR-101: a withdrawn complaint can never be picked up — the
              route rejects it regardless, but hide the control too so
              staff aren't offered an action that can only fail. */}
          {!c.assignedStaffRef && c.status !== "withdrawn" && (
            <AssignSelfButton complaintId={String(c._id)} />
          )}

          {c.status !== "withdrawn" && (
            <AssignmentDialog
              complaintId={String(c._id)}
              currentOfficeId={session!.user.officeRef ?? null}
              currentOfficeName={currentOfficeName}
              currentStaffId={c.assignedStaffRef ? String(c.assignedStaffRef) : null}
              currentStaffName={currentStaffName}
              offices={[
                {
                  _id: session!.user.officeRef!,
                  name: currentOfficeName,
                  type: (office as any)?.type,
                },
              ]}
              canChangeOffice={false}
              label={c.assignedStaffRef ? "Reassign Complaint" : "Assign Staff"}
              action={c.assignedStaffRef ? "reassign" : "assign"}
            />
          )}

          {String(c.assignedStaffRef) === session!.user.id && (
            <StatusUpdateForm complaintId={String(c._id)} currentStatus={c.status} />
          )}

          {(String(c.assignedStaffRef ?? "") === session!.user.id ||
            c.status === "pending_information") && (
            <InformationRequestPanel
              complaintId={String(c._id)}
              status={c.status}
              canRequest={String(c.assignedStaffRef ?? "") === session!.user.id}
              requests={JSON.parse(JSON.stringify(informationRequests))}
            />
          )}

          {String(c.assignedStaffRef ?? "") === session!.user.id &&
            escalationTarget &&
            c.status !== "withdrawn" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--qa-amber)]/30 bg-[var(--qa-amber-soft)] px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-[var(--qa-amber-strong)] uppercase">
                    Next escalation target
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--qa-amber-strong)]">
                    {escalationTarget.office.name} Office Head
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--qa-amber-strong)]/80">
                    {escalationTarget.staff.firstName} {escalationTarget.staff.lastName} · {escalationTarget.staff.email}
                  </p>
                  <p className="mt-2 text-xs text-[var(--qa-amber-strong)]/80">
                    The destination is computed from the office hierarchy and cannot be selected manually.
                  </p>
                </div>
                <AssignmentDialog
                  complaintId={String(c._id)}
                  currentOfficeId={String(c.assignedOfficeRef)}
                  currentOfficeName={currentOfficeName}
                  currentStaffId={String(c.assignedStaffRef)}
                  currentStaffName={currentStaffName}
                  offices={[{ _id: String(escalationTarget.office._id), name: escalationTarget.office.name, type: escalationTarget.office.type }]}
                  canChangeOffice
                  label="Escalate Complaint"
                  action="escalate"
                  destinationOfficeId={String(escalationTarget.office._id)}
                  destinationStaffId={String(escalationTarget.staff._id)}
                />
              </div>
            )}

          {String(c.assignedStaffRef ?? "") === session!.user.id &&
            !escalationTarget &&
            c.status !== "withdrawn" && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 text-sm text-[var(--muted-foreground)]">
                No higher escalation authority is configured for this office.
              </div>
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
