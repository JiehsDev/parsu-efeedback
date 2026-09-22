import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ComplaintNote } from "@/models/ComplaintNote";
import { InformationRequest } from "@/models/InformationRequest";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { AssignmentDialog } from "@/components/shared/AssignmentDialog";
import { AssignmentHistoryPanel } from "@/components/shared/AssignmentHistoryPanel";
import { StatusUpdateForm } from "@/components/staff/StatusUpdateForm";
import { InformationRequestPanel } from "@/components/staff/InformationRequestPanel";
import { AssignSelfButton } from "@/components/staff/AssignSelfButton";
import { NotesSection } from "@/components/shared/NotesSection";
import { AttachmentGallery } from "@/components/shared/AttachmentGallery";
import { CopyButton } from "@/components/shared/CopyButton";
import { SlaDetails } from "@/components/shared/SlaDetails";
import { ArchiveRequestButton } from "@/components/staff/ArchiveRequestButton";
import { ArchiveApprovalPanel } from "@/components/staff/ArchiveApprovalPanel";
import { ArchiveComplaintToggle } from "@/components/admin/ArchiveComplaintToggle";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { ReopenComplaintButton } from "@/components/shared/ReopenComplaintButton";
import { getAssignmentHistoryEntries } from "@/lib/assignment-history";
import { resolveManualEscalationTarget } from "@/lib/manual-escalation";
import type { ComplaintStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function StaffComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).read("primary").populate({
    path: "studentRef",
    select: "employeeOrStudentId collegeRef",
    populate: { path: "collegeRef", select: "name" },
  }).lean();
  if (!complaint || String((complaint as any).assignedOfficeRef) !== session.user.officeRef) notFound();
  const c = complaint as any;

  const [timeline, notes, office, assignedStaff, assignmentHistory, informationRequests, archiveRequests, escalationTarget] = await Promise.all([
    ComplaintTimeline.find({ complaintRef: id }).sort({ createdAt: 1 }).populate("actorRef", "firstName lastName role").lean(),
    ComplaintNote.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
    Office.findById(session.user.officeRef).select("name type headUserRef").lean(),
    c.assignedStaffRef ? User.findById(c.assignedStaffRef).select("firstName lastName email role").lean() : null,
    getAssignmentHistoryEntries(id),
    InformationRequest.find({ complaintRef: id }).sort({ requestedAt: -1 }).populate("requestedByRef", "firstName lastName role").populate("responseAttachmentRefs", "fileName mimeType sizeBytes").lean(),
    ArchiveRequest.find({ complaintRef: id }).sort({ createdAt: -1 }).populate("requestedByRef", "firstName lastName role").lean(),
    String(c.assignedStaffRef ?? "") === session.user.id && !["withdrawn", "resolved", "closed"].includes(c.status) ? resolveManualEscalationTarget(c, session.user.role) : null,
  ]);

  const currentOfficeName = (office as any)?.name ?? "Your office";
  const currentStaffName = assignedStaff ? `${(assignedStaff as any).firstName} ${(assignedStaff as any).lastName}` : null;
  const firstResponseAt = assignmentHistory.find((entry) => entry.assignedByName)?.createdAt ?? null;
  const requests = JSON.parse(JSON.stringify(informationRequests));
  const activeRequest = requests.find((request: any) => request.status === "open");
  const archiveHistory = JSON.parse(JSON.stringify(archiveRequests));
  const pendingArchive = archiveHistory.find((request: any) => request.status === "pending");
  const isOfficeHead = String((office as any)?.headUserRef ?? "") === session.user.id;
  const canArchive = ["submitted", "assigned", "in_progress", "pending_information", "escalated", "resolved", "closed", "withdrawn"].includes(c.status);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <Link href="/staff/complaints" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-3.5 w-3.5" />Back to queue</Link>

      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="min-w-0"><p className="flex items-center gap-1 font-mono text-xs text-[var(--muted-foreground)]">{c.ticketNumber}<CopyButton value={c.ticketNumber} /></p><h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{c.title}{c.isArchived && <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]">Archived</span>}</h1></div>
        <div className="shrink-0 lg:hidden"><StatusBadge status={c.status as ComplaintStatus} /></div>
      </header>

      {c.status === "pending_information" && activeRequest && <section className="rounded-2xl border border-[var(--qa-amber)]/40 bg-[var(--qa-amber-soft)] px-4 py-3 sm:px-5" aria-labelledby="waiting-information-heading"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="waiting-information-heading" className="text-sm font-semibold text-[var(--qa-amber-strong)]">Waiting for Student Information</h2><span className="rounded-full bg-[var(--qa-amber)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--qa-amber-strong)]">Awaiting Student Response</span></div><p className="mt-1 text-sm text-[var(--qa-amber-strong)]">{activeRequest.requestMessage}</p><p className="mt-1 text-xs text-[var(--qa-amber-strong)]/75">Requested {new Date(activeRequest.requestedAt).toLocaleString()} by {activeRequest.requestedByRef?.firstName ?? "staff"} {activeRequest.requestedByRef?.lastName ?? ""}</p></section>}
      {c.isArchived && <section className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-[var(--foreground)]">Archived Complaint</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">This complaint is retained for record purposes and is no longer active.</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Reason: {c.archiveReason || "Not recorded"} · Archived {c.archivedAt ? new Date(c.archivedAt).toLocaleString() : "date unavailable"}</p></section>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-labelledby="complaint-context-heading"><div className="flex items-center justify-between gap-3"><h2 id="complaint-context-heading" className="text-sm font-semibold text-[var(--foreground)]">Complaint context</h2><StatusBadge status={c.status as ComplaintStatus} /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-6"><ContextItem label="Complainant" value={c.studentRef?.employeeOrStudentId ?? "—"} /><ContextItem label="Office" value={currentOfficeName} /><ContextItem label="Priority" value={c.priority} dot={PRIORITY_DOT[c.priority]} /><ContextItem label="Ticket" value={c.ticketNumber} mono /><ContextItem label="Submitted" value={new Date(c.submittedAt).toLocaleDateString()} /><ContextItem label="Current owner" value={currentStaffName ?? "Office level"} /></dl></section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(320px,4fr)]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl shadow-black/10 sm:p-7" aria-labelledby="description-heading"><h2 id="description-heading" className="text-sm font-semibold text-[var(--foreground)]">Description</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed whitespace-pre-line text-[var(--foreground)]/90">{c.description}</p>{!c.assignedStaffRef && c.status !== "withdrawn" && <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-400"><UserX className="h-4 w-4 shrink-0" />Nobody has picked this up yet.</div>}</section>
          <AttachmentGallery complaintId={String(c._id)} />
          <NotesSection complaintId={String(c._id)} initialNotes={JSON.parse(JSON.stringify(notes))} readOnly={Boolean(c.isArchived)} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5" aria-labelledby="timeline-heading"><div className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--muted-foreground)]" /><h2 id="timeline-heading" className="text-sm font-semibold text-[var(--foreground)]">Timeline</h2></div><div className="mt-4">{timeline.map((event: any) => <TimelineEvent key={event._id} event={event} />)}</div></section><AssignmentHistoryPanel entries={assignmentHistory} /></div>
        </main>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-5 lg:self-start">
          <section className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--card)] p-4 shadow-lg shadow-black/10 sm:p-5" aria-labelledby="complaint-actions-heading"><div className="flex items-center justify-between gap-3"><h2 id="complaint-actions-heading" className="text-base font-semibold text-[var(--foreground)]">Complaint Actions</h2><span className="text-xs text-[var(--muted-foreground)]">Workflow</span></div><div className="mt-4 space-y-3">
             {!c.isArchived && !c.assignedStaffRef && !["withdrawn", "resolved", "closed"].includes(c.status) && <AssignSelfButton complaintId={String(c._id)} />}
             {!c.isArchived && !["withdrawn", "resolved", "closed"].includes(c.status) && <AssignmentDialog complaintId={String(c._id)} currentOfficeId={session.user.officeRef ?? null} currentOfficeName={currentOfficeName} currentStaffId={c.assignedStaffRef ? String(c.assignedStaffRef) : null} currentStaffName={currentStaffName} offices={[{ _id: session.user.officeRef!, name: currentOfficeName, type: (office as any)?.type }]} canChangeOffice={false} label={c.assignedStaffRef ? "Reassign Complaint" : "Assign Staff"} action={c.assignedStaffRef ? "reassign" : "assign"} />}
             {!c.isArchived && !["resolved", "closed"].includes(c.status) && String(c.assignedStaffRef) === session.user.id && <StatusUpdateForm complaintId={String(c._id)} currentStatus={c.status} />}
             {isOfficeHead && c.status === "resolved" && <ReopenComplaintButton complaintId={String(c._id)} />}
            {c.status === "resolved" && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Resolved · Waiting for Student Rating</p>}
             {!c.isArchived && !["resolved", "closed"].includes(c.status) && (String(c.assignedStaffRef ?? "") === session.user.id || c.status === "pending_information") && <InformationRequestPanel complaintId={String(c._id)} status={c.status} canRequest={String(c.assignedStaffRef ?? "") === session.user.id} requests={requests} />}
            {c.isArchived ? <p className="rounded-xl bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">Archived complaints are read-only until restored.</p> : isOfficeHead && pendingArchive ? <ArchiveApprovalPanel request={pendingArchive} /> : isOfficeHead && canArchive ? <ArchiveComplaintToggle complaintId={String(c._id)} ticketNumber={c.ticketNumber} isArchived={false} mode="head" /> : !isOfficeHead && session.user.role === "office_staff" && canArchive && !pendingArchive && (!c.assignedStaffRef || String(c.assignedStaffRef) === session.user.id) ? <ArchiveRequestButton complaintId={String(c._id)} /> : pendingArchive ? <p className="rounded-xl bg-[var(--qa-amber-soft)] px-3 py-2 text-xs text-[var(--qa-amber-strong)]">Archive Request Pending</p> : null}
            {String(c.assignedStaffRef ?? "") === session.user.id && escalationTarget && c.status !== "withdrawn" && <div className="space-y-3"><div className="rounded-xl border border-[var(--qa-amber)]/30 bg-[var(--qa-amber-soft)] px-3 py-2.5"><p className="text-[11px] font-semibold tracking-wide text-[var(--qa-amber-strong)] uppercase">Next escalation target</p><p className="mt-1 text-sm font-semibold text-[var(--qa-amber-strong)]">{escalationTarget.office.name} Office Head</p><p className="mt-0.5 text-xs text-[var(--qa-amber-strong)]/80">{escalationTarget.staff.firstName} {escalationTarget.staff.lastName} · {escalationTarget.staff.email}</p></div><AssignmentDialog complaintId={String(c._id)} currentOfficeId={String(c.assignedOfficeRef)} currentOfficeName={currentOfficeName} currentStaffId={String(c.assignedStaffRef)} currentStaffName={currentStaffName} offices={[{ _id: String(escalationTarget.office._id), name: escalationTarget.office.name, type: escalationTarget.office.type }]} canChangeOffice action="escalate" label="Escalate Complaint" destinationOfficeId={String(escalationTarget.office._id)} destinationStaffId={String(escalationTarget.staff._id)} /></div>}
            {String(c.assignedStaffRef ?? "") === session.user.id && !escalationTarget && c.status !== "withdrawn" && <p className="text-xs text-[var(--muted-foreground)]">No higher escalation authority is configured.</p>}
          </div></section>
          <SlaDetails complaint={c} firstResponseAt={firstResponseAt} events={timeline as any} />
        </aside>
      </div>
    </div>
  );
}

function ContextItem({ label, value, dot, mono }: { label: string; value: string; dot?: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--muted-foreground)]">{label}</dt><dd className={`mt-1 truncate text-[var(--foreground)] ${mono ? "font-mono text-xs" : ""}`}>{dot && <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${dot}`} />}{value}</dd></div>;
}
