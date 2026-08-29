// src/app/qa/complaints/[id]/page.tsx
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
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
import { Office } from "@/models/Office";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { ComplaintNote } from "@/models/ComplaintNote";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { NotesSection } from "@/components/shared/NotesSection";
import { AttachmentGallery } from "@/components/shared/AttachmentGallery";
import { CopyButton } from "@/components/shared/CopyButton";
import type { ComplaintStatus } from "@/lib/constants";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function QaComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) notFound();

  const c = complaint as any;

  const [student, office, timeline, notes] = await Promise.all([
    // Student identity is kept out of the QA view — ID + college only,
    // not name, so a complaint reads a little more anonymous.
    User.findById(c.studentRef)
      .select("employeeOrStudentId collegeRef")
      .populate("collegeRef", "name")
      .lean(),
    c.assignedOfficeRef ? Office.findById(c.assignedOfficeRef).lean() : null,
    ComplaintTimeline.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
    ComplaintNote.find({ complaintRef: id }).sort({ createdAt: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/qa/complaints"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to complaints
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
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
