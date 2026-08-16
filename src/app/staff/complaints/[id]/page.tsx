// src/app/staff/complaints/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Flag, Hash, History, UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ComplaintNote } from "@/models/ComplaintNote";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { StatusUpdateForm } from "@/components/staff/StatusUpdateForm";
import { NotesSection } from "@/components/staff/NotesSection";
import { AssignSelfButton } from "@/components/staff/AssignSelfButton";
import type { ComplaintStatus } from "@/lib/constants";
import { AttachmentGallery } from "@/components/shared/AttachmentGallery";
import { CopyButton } from "@/components/shared/CopyButton";

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
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint || String((complaint as any).assignedOfficeRef) !== session!.user.officeRef) {
    notFound();
  }

  const c = complaint as any;

  const [timeline, notes] = await Promise.all([
    ComplaintTimeline.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
    ComplaintNote.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
  ]);

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
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8">
            <p className="text-sm font-semibold text-[var(--foreground)]">Description</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--foreground)]/90">
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
                  <Flag className="h-3.5 w-3.5" />
                  Priority
                </dt>
                <dd className="mt-1.5 flex items-center gap-1.5 capitalize text-[var(--foreground)]">
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

          {!c.assignedStaffRef && <AssignSelfButton complaintId={String(c._id)} />}

          {String(c.assignedStaffRef) === session!.user.id && (
            <StatusUpdateForm complaintId={String(c._id)} currentStatus={c.status} />
          )}

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
