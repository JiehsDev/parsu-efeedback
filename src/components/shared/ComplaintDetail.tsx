import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessComplaint, canWriteInternalComplaintNotes } from "@/lib/complaint-access";
import { canSuperviseComplaint, refId } from "@/lib/osas-operations";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ComplaintNote } from "@/models/ComplaintNote";
import { Office } from "@/models/Office";
import { User } from "@/models/User";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { InformationRequest } from "@/models/InformationRequest";
import { getAssignmentHistoryEntries } from "@/lib/assignment-history";
import { StatusBadge } from "./StatusBadge";
import { ComplaintResolution } from "./ComplaintResolution";
import { ComplaintUpdateMessages } from "./ComplaintUpdateMessages";
import { AttachmentGallery } from "./AttachmentGallery";
import { NotesSection } from "@/components/shared/NotesSection";
import { TimelineEvent } from "./TimelineEvent";
import { AssignmentHistoryPanel } from "./AssignmentHistoryPanel";
import { SlaDetails } from "./SlaDetails";
import { ForwardingPanel } from "./ForwardingPanel";
import { ForwardingRequest } from "@/models/ForwardingRequest";
import { canProcessComplaint, isOsasComplaint } from "@/lib/osas-operations";
import { ComplaintActions } from "./ComplaintActions";
const plain = (value: any) => JSON.parse(JSON.stringify(value));
export async function ComplaintDetail({ id, base }: { id: string; base: "admin" | "staff" }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const c: any = await Complaint.findById(id)
    .populate("resolvedByRef", "firstName lastName")
    .populate("categoryRef", "name domain")
    .populate({
      path: "studentRef",
      select: "employeeOrStudentId collegeRef",
      populate: { path: "collegeRef", select: "name" },
    })
    .lean();
  if (!c || !(await canAccessComplaint(session, c))) notFound();
  const [timeline, notes, office, staff, history, requests, archives] = await Promise.all([
    ComplaintTimeline.find({ complaintRef: id })
      .sort({ createdAt: 1 })
      .populate("actorRef", "firstName lastName role employeeOrStudentId")
      .lean(),
    ComplaintNote.find({ complaintRef: id })
      .sort({ createdAt: 1 })
      .populate("authorRef", "firstName lastName role")
      .lean(),
    Office.findById(c.assignedOfficeRef).lean(),
    c.assignedStaffRef
      ? User.findById(c.assignedStaffRef).select("firstName lastName").lean()
      : null,
    getAssignmentHistoryEntries(id),
    InformationRequest.find({ complaintRef: id })
      .sort({ requestedAt: -1 })
      .populate("requestedByRef", "firstName lastName role")
      .lean(),
    ArchiveRequest.find({ complaintRef: id })
      .sort({ createdAt: -1 })
      .populate("requestedByRef", "firstName lastName role")
      .lean(),
  ]);
  const forwarding = await ForwardingRequest.find({ complaintRef: id })
    .sort({ requestedAt: -1 })
    .populate("requestedByUserRef reviewedByUserRef", "firstName lastName")
    .lean();
  const forwardingHead = await canSuperviseComplaint(session, c);
  const canRequestForwarding =
    !c.isArchived &&
    ["submitted", "assigned", "in_progress", "pending_information", "escalated"].includes(
      c.status,
    ) &&
    (await isOsasComplaint(c)) &&
    (forwardingHead || (await canProcessComplaint(session, c)));
  const readOnly = !(await canWriteInternalComplaintNotes(session, c));
  const viewOnly =
    ["office_staff", "osas"].includes(session.user.role) &&
    refId(c.assignedStaffRef) !== session.user.id &&
    !(await canSuperviseComplaint(session, c));
  return (
    <div className="workspace-page space-y-5">
      <Link href={`/${base}/complaints`} className="text-sm text-[var(--muted-foreground)]">
        Back to complaints
      </Link>
      <header className="border-b border-[var(--border)] pb-5">
        <p className="font-mono text-xs text-[var(--muted-foreground)]">{c.ticketNumber}</p>
        <h1 className="mt-1 text-2xl font-bold">{c.title}</h1>
        <div className="mt-2 flex gap-2">
          <StatusBadge status={c.status} />
          {c.isArchived && <span>Archived</span>}
          {c.supervisorReviewRequired && (
            <span className="text-sm text-amber-600">OSAS supervisor review</span>
          )}
        </div>
      </header>
      {viewOnly && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 text-sm text-[var(--foreground)]">
          View only. You can review this office complaint, but only its assigned handler can take
          action.
        </p>
      )}
      <div className="reading-layout">
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="text-sm font-semibold">Description</h2>
            <p className="mt-2 text-sm break-words whitespace-pre-wrap">{c.description}</p>
          </section>
          <ComplaintUpdateMessages events={timeline} />
          <ComplaintResolution
            summary={c.resolutionSummary}
            status={c.status}
            resolvedAt={c.resolvedAt}
            resolverName={
              c.resolvedByRef
                ? `${c.resolvedByRef.firstName} ${c.resolvedByRef.lastName}`
                : "Not recorded"
            }
          />
          <AttachmentGallery complaintId={id} />
          <NotesSection complaintId={id} initialNotes={plain(notes)} readOnly={readOnly} />
          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="mb-4 text-sm font-semibold">Timeline</h2>
            {timeline.map((event: any) => (
              <TimelineEvent key={refId(event._id)} event={event} />
            ))}
          </section>
          <AssignmentHistoryPanel entries={history} />
        </div>
        <aside className="space-y-5">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {Object.entries({
                Complainant: c.studentRef?.employeeOrStudentId ?? "Unavailable",
                College: c.studentRef?.collegeRef?.name ?? "Unavailable",
                Category: c.categoryRef?.name ?? "Unavailable",
                Domain: c.categoryRef?.domain ?? "other",
                "Handling office": office?.name ?? "Historical office",
                Assignee: staff ? `${staff.firstName} ${staff.lastName}` : "Unassigned",
                Priority: c.priority,
                Submitted: new Date(c.submittedAt).toLocaleString(),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <ForwardingPanel
            base={base}
            complaintId={id}
            head={forwardingHead}
            canRequest={canRequestForwarding}
            requests={plain(forwarding)}
          />
          <ComplaintActions
            session={session}
            complaint={c}
            office={office}
            staff={staff}
            requests={plain(requests)}
            archives={plain(archives)}
          />
          <SlaDetails
            complaint={c}
            firstResponseAt={history.find((entry) => entry.assignedByName)?.createdAt ?? null}
            events={timeline as any}
          />
        </aside>
      </div>
    </div>
  );
}
