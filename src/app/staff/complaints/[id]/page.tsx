// src/app/staff/complaints/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
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
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Link
          href="/staff/complaints"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to queue
        </Link>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-[var(--muted-foreground)]">{c.ticketNumber}</p>
              <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{c.title}</h1>
            </div>
            <StatusBadge status={c.status as ComplaintStatus} />
          </div>

          <p className="mt-4 text-sm text-[var(--foreground)]">{c.description}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted-foreground)]">Priority</dt>
              <dd className="text-[var(--foreground)] capitalize">{c.priority}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Submitted</dt>
              <dd className="text-[var(--foreground)]">
                {new Date(c.submittedAt).toLocaleString()}
              </dd>
            </div>
          </dl>

          {!c.assignedStaffRef && (
            <div className="mt-4">
              <AssignSelfButton complaintId={String(c._id)} />
            </div>
          )}
        </div>

        {String(c.assignedStaffRef) === session!.user.id && (
          <StatusUpdateForm complaintId={String(c._id)} currentStatus={c.status} />
        )}

        <NotesSection
          complaintId={String(c._id)}
          initialNotes={JSON.parse(JSON.stringify(notes))}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Timeline</h2>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
          {timeline.map((event: any) => (
            <TimelineEvent key={event._id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}
