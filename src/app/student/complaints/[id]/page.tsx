// src/app/student/complaints/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { RatingForm } from "@/components/student/RatingForm";
import type { ComplaintStatus } from "@/lib/constants";

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint || String((complaint as any).studentRef) !== session!.user.id) {
    notFound();
  }

  const timeline = await ComplaintTimeline.find({ complaintRef: id }).sort({ createdAt: 1 }).lean();

  const c = complaint as any;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/student/complaints"
        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        ← Back to my complaints
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
            <dd className="text-[var(--foreground)]">{new Date(c.submittedAt).toLocaleString()}</dd>
          </div>
          {c.resolvedAt && (
            <div>
              <dt className="text-[var(--muted-foreground)]">Resolved</dt>
              <dd className="text-[var(--foreground)]">
                {new Date(c.resolvedAt).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {c.status === "resolved" && c.studentRating === null && (
        <RatingForm complaintId={String(c._id)} />
      )}

      {c.studentRating !== null && c.studentRating !== undefined && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">Your rating</p>
          <p className="mt-1 text-[var(--primary)]">
            {"★".repeat(c.studentRating)}
            {"☆".repeat(5 - c.studentRating)}
          </p>
          {c.studentRatingComment && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{c.studentRatingComment}</p>
          )}
        </div>
      )}

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
