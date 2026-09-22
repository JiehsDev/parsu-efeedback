// src/app/student/complaints/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Flag,
  Hash,
  History,
  Star,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Office } from "@/models/Office";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { AssignmentHistoryPanel } from "@/components/shared/AssignmentHistoryPanel";
import { ResolutionActions, ClosedResolutionSummary } from "@/components/student/ResolutionActions";
import { EditWithdrawComplaint } from "@/components/student/EditWithdrawComplaint";
import type { ComplaintStatus } from "@/lib/constants";
import { AttachmentGallery } from "@/components/shared/AttachmentGallery";
import { CopyButton } from "@/components/shared/CopyButton";
import { getAssignmentHistoryEntries } from "@/lib/assignment-history";
import { InformationRequest } from "@/models/InformationRequest";
import { InformationResponseForm } from "@/components/student/InformationResponseForm";
import { SlaDetails } from "@/components/shared/SlaDetails";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint || String((complaint as any).studentRef) !== session!.user.id) {
    notFound();
  }

  const c = complaint as any;
  const [timeline, assignedOffice, assignmentHistory, openInformationRequest] = await Promise.all([
    ComplaintTimeline.find({ complaintRef: id })
      .sort({ createdAt: 1 })
      .populate("actorRef", "firstName lastName role employeeOrStudentId")
      .lean(),
    c.assignedOfficeRef ? Office.findById(c.assignedOfficeRef).select("name").lean() : null,
    getAssignmentHistoryEntries(id),
    InformationRequest.findOne({ complaintRef: id, status: "open" })
      .sort({ requestedAt: -1 })
      .lean(),
  ]);
  const firstResponseAt = assignmentHistory.find((entry) => entry.assignedByName)?.createdAt ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/student/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to my complaints
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-medium text-[var(--foreground)]">Description</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--foreground)]/90">
              {c.description}
            </p>
          </div>

          {c.status === "submitted" && (
            <EditWithdrawComplaint
              complaintId={String(c._id)}
              ticketNumber={c.ticketNumber}
              initialTitle={c.title}
              initialDescription={c.description}
            />
          )}

          {c.status === "pending_information" && openInformationRequest && assignedOffice && (
            <InformationResponseForm
              complaintId={String(c._id)}
              requestMessage={(openInformationRequest as any).requestMessage}
              requestedAt={(openInformationRequest as any).requestedAt}
              officeName={(assignedOffice as any).name}
            />
          )}

          {c.status === "resolved" && <ResolutionActions complaintId={String(c._id)} />}

          {c.status === "closed" && (
            <ClosedResolutionSummary
              closureType={c.closureType ?? null}
              studentRating={c.studentRating ?? null}
              studentRatingComment={c.studentRatingComment ?? ""}
            />
          )}

          <AttachmentGallery complaintId={String(c._id)} />

          <AssignmentHistoryPanel entries={assignmentHistory} simplified />

          <div>
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--muted-foreground)]" />
              <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                Timeline
              </h2>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              {timeline.map((event: any) => (
              <TimelineEvent key={event._id} event={event} viewerRole="student" />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <SlaDetails
            complaint={c}
            firstResponseAt={firstResponseAt}
            events={timeline as any}
            simplified
          />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">Details</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="hidden lg:block">
                <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  Status
                </dt>
                <dd className="mt-1.5">
                  <StatusBadge status={c.status as ComplaintStatus} />
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
                  <Building2 className="h-3.5 w-3.5" />
                  Responsible Office
                </dt>
                <dd className="mt-1.5 text-[var(--foreground)]">
                  {assignedOffice ? (assignedOffice as any).name : "Not assigned yet"}
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
              {c.resolvedAt && (
                <div>
                  <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Resolved
                  </dt>
                  <dd className="mt-1.5 text-[var(--foreground)]">
                    {new Date(c.resolvedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {c.studentRating !== null && c.studentRating !== undefined && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-sm font-medium text-[var(--foreground)]">Your rating</p>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= c.studentRating
                        ? "fill-[var(--primary)] text-[var(--primary)]"
                        : "text-[var(--border)]"
                    }`}
                  />
                ))}
              </div>
              {c.studentRatingComment && (
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {c.studentRatingComment}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
