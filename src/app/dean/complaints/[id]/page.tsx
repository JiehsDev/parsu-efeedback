// src/app/dean/complaints/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { User } from "@/models/User";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TimelineEvent } from "@/components/shared/TimelineEvent";
import { ReassignForm } from "@/components/dean/ReassignForm";
import type { ComplaintStatus } from "@/lib/constants";

export default async function DeanComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  await connectToDatabase();
  const { id } = await params;

  const complaint = await Complaint.findById(id).lean();
  if (!complaint) notFound();

  const c = complaint as any;
  const student = await User.findById(c.studentRef).lean();
  if (!student || String((student as any).collegeRef) !== session!.user.collegeRef) {
    notFound();
  }

  const timeline = await ComplaintTimeline.find({ complaintRef: id }).sort({ createdAt: 1 }).lean();

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Link
          href="/dean/complaints"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to complaints
        </Link>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-[var(--muted-foreground)]">{c.ticketNumber}</p>
              <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{c.title}</h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {(student as any).firstName} {(student as any).lastName}
              </p>
            </div>
            <StatusBadge status={c.status as ComplaintStatus} />
          </div>

          <p className="mt-4 text-sm text-[var(--foreground)]">{c.description}</p>
        </div>

        <ReassignForm complaintId={String(c._id)} currentOfficeRef={String(c.assignedOfficeRef)} />
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
