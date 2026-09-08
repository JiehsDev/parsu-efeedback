// src/app/staff/sla/page.tsx
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Timer } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import {
  ComplaintListRow,
  ComplaintRowHeader,
  slaClock,
  type ComplaintRowData,
} from "@/components/shared/ComplaintListRow";

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

function GroupedList({ complaints }: { complaints: ComplaintRowData[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
      <ComplaintRowHeader />
      <ul className="divide-y divide-[var(--border)]">
        {complaints.map((c) => (
          <ComplaintListRow key={String(c._id)} complaint={c} hrefPrefix="/staff/complaints" />
        ))}
      </ul>
    </div>
  );
}

export default async function StaffSlaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();

  const officeRef = session!.user.officeRef;

  const complaints = await Complaint.find({
    assignedOfficeRef: officeRef,
    status: { $nin: ["resolved", "closed", "withdrawn"] as const },
    isArchived: false,
  }).lean();

  // Sort by the live SLA clock (response deadline pre-assignment, resolution
  // deadline after — see slaClock()) rather than slaResolutionDueAt alone,
  // since a submitted complaint may not have a resolution deadline yet.
  const withClock = (complaints as unknown as ComplaintRowData[])
    .map((c) => ({ complaint: c, clock: slaClock(c) }))
    .sort((a, b) => {
      const aTime = a.clock ? new Date(a.clock.dueAt).getTime() : Infinity;
      const bTime = b.clock ? new Date(b.clock.dueAt).getTime() : Infinity;
      return aTime - bTime;
    });

  const overdue: ComplaintRowData[] = [];
  const dueSoon: ComplaintRowData[] = [];
  const onTrack: ComplaintRowData[] = [];

  for (const { complaint, clock } of withClock) {
    if (clock?.overdue) {
      overdue.push(complaint);
    } else if (clock && new Date(clock.dueAt).getTime() - Date.now() < DUE_SOON_WINDOW_MS) {
      dueSoon.push(complaint);
    } else {
      onTrack.push(complaint);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          SLA Tracker
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Open complaints in your office, sorted by deadline.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <div className="rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-2 py-2.5 text-center">
          <p className="text-lg font-bold leading-none tracking-tight text-[var(--destructive)]">
            {overdue.length}
          </p>
          <p className="mt-1 text-[11px] leading-none text-[var(--muted-foreground)]">Overdue</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2.5 text-center">
          <p className="text-lg font-bold leading-none tracking-tight text-amber-400">
            {dueSoon.length}
          </p>
          <p className="mt-1 text-[11px] leading-none text-[var(--muted-foreground)]">
            Due 24h
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2.5 text-center">
          <p className="text-lg font-bold leading-none tracking-tight text-[var(--foreground)]">
            {onTrack.length}
          </p>
          <p className="mt-1 text-[11px] leading-none text-[var(--muted-foreground)]">
            On Track
          </p>
        </div>
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
        <div className="rounded-3xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--destructive)]/20 text-[var(--destructive)]">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--destructive)]">
            {overdue.length}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Overdue</p>
        </div>
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <Timer className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight text-amber-400">{dueSoon.length}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Due within 24h</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {onTrack.length}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">On Track</p>
        </div>
      </div>

      {complaints.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No open complaints in your office.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <div className="space-y-2.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--destructive)]">
                Overdue
              </p>
              <GroupedList complaints={overdue} />
            </div>
          )}
          {dueSoon.length > 0 && (
            <div className="space-y-2.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                Due within 24 hours
              </p>
              <GroupedList complaints={dueSoon} />
            </div>
          )}
          {onTrack.length > 0 && (
            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                <Clock3 className="h-3 w-3" />
                On track
              </p>
              <GroupedList complaints={onTrack} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
