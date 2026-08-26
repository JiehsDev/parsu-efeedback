// src/app/staff/sla/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Timer } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

function timeRemaining(dueAt: Date | null): { text: string; isCritical: boolean } {
  if (!dueAt) return { text: "—", isCritical: false };
  const now = new Date();
  const diffMs = new Date(dueAt).getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return { text: `Overdue by ${Math.abs(Math.round(diffHours))}h`, isCritical: true };
  }
  if (diffHours < 4) {
    return { text: `${Math.round(diffHours)}h remaining`, isCritical: true };
  }
  if (diffHours < 24) {
    return { text: `${Math.round(diffHours)}h remaining`, isCritical: false };
  }
  return { text: `${Math.round(diffHours / 24)}d remaining`, isCritical: false };
}

function GroupedList({ complaints }: { complaints: any[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
      <ul className="divide-y divide-[var(--border)]">
        {complaints.map((c) => {
          const remaining = timeRemaining(c.slaResolutionDueAt);
          return (
            <li key={c._id}>
              <Link
                href={`/staff/complaints/${c._id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--muted)]/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                    {c.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span className="font-mono">{c.ticketNumber}</span>
                  </span>
                </span>
                <StatusBadge status={c.status as ComplaintStatus} />
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    remaining.isCritical ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {remaining.text}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              </Link>
            </li>
          );
        })}
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
    status: { $nin: ["resolved", "closed"] },
    isArchived: false,
  })
    .sort({ slaResolutionDueAt: 1 })
    .lean();

  const overdue = complaints.filter((c: any) => c.isOverdue);
  const dueSoon = complaints.filter((c: any) => {
    if (c.isOverdue || !c.slaResolutionDueAt) return false;
    const hours = (new Date(c.slaResolutionDueAt).getTime() - Date.now()) / (1000 * 60 * 60);
    return hours < 24;
  });
  const onTrack = complaints.filter((c: any) => !overdue.includes(c) && !dueSoon.includes(c));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          SLA Tracker
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Open complaints in your office, sorted by resolution deadline.
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
