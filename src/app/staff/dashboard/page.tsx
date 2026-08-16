// src/app/staff/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Inbox,
  ListChecks,
  Loader2,
  Timer,
  UserPlus,
} from "lucide-react";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

export default async function StaffDashboardPage() {
  const session = await auth();
  await connectToDatabase();

  if (!session!.user.officeRef) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <Building2 className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
          No office is assigned to this account.
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Contact an administrator.</p>
      </div>
    );
  }
  const officeRef = new Types.ObjectId(session!.user.officeRef);
  const firstName = session!.user.name?.split(" ")[0] ?? "there";

  const [statusCounts, overdueCount, unassignedCount, unassignedPreview] = await Promise.all([
    Complaint.aggregate([
      { $match: { assignedOfficeRef: officeRef, isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Complaint.countDocuments({
      assignedOfficeRef: officeRef,
      isOverdue: true,
      status: { $nin: ["resolved", "closed"] },
    }),
    Complaint.countDocuments({
      assignedOfficeRef: officeRef,
      assignedStaffRef: null,
      status: { $nin: ["resolved", "closed"] },
    }),
    Complaint.find({
      assignedOfficeRef: officeRef,
      assignedStaffRef: null,
      status: { $nin: ["resolved", "closed"] },
      isArchived: false,
    })
      .sort({ slaResponseDueAt: 1 })
      .limit(5)
      .lean(),
  ]);

  const countMap: Record<string, number> = Object.fromEntries(
    statusCounts.map((s: any) => [s._id, s.count]),
  );

  const STATS = [
    {
      label: "Unassigned",
      value: unassignedCount,
      icon: UserPlus,
      tint: "bg-amber-500/15 text-amber-400",
      chipBorder: "border-amber-500/30",
      chipBg: "bg-amber-500/10",
      chipText: "text-amber-400",
    },
    {
      label: "In Progress",
      value: countMap.in_progress ?? 0,
      icon: Loader2,
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
    {
      label: "Overdue",
      value: overdueCount,
      icon: AlertTriangle,
      tint: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
      chipBorder: "border-[var(--destructive)]/30",
      chipBg: "bg-[var(--destructive)]/10",
      chipText: "text-[var(--destructive)]",
    },
    {
      label: "Resolved",
      value: countMap.resolved ?? 0,
      icon: CheckCircle2,
      tint: "bg-emerald-500/15 text-emerald-400",
      chipBorder: "border-emerald-500/30",
      chipBg: "bg-emerald-500/10",
      chipText: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Hey, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Here's what's happening in your office queue.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:hidden">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-1.5 py-2.5 text-center ${stat.chipBorder} ${stat.chipBg}`}
          >
            <p className={`text-lg font-bold leading-none tracking-tight ${stat.chipText}`}>
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] leading-tight text-[var(--muted-foreground)]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tint}`}
            >
              <stat.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--foreground)]">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Needs a claimant
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Unassigned complaints, oldest first-response deadline first.
              </p>
            </div>
            <Link
              href="/staff/complaints"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              View queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {unassignedPreview.length === 0 ? (
            <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border)] py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">All caught up</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Nothing unassigned in your office right now.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {unassignedPreview.map((c: any) => (
                <li key={c._id}>
                  <Link
                    href={`/staff/complaints/${c._id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--muted)]/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)]">
                      <Inbox className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                        {c.title}
                      </span>
                      <span className="block font-mono text-xs text-[var(--muted-foreground)]">
                        {c.ticketNumber}
                      </span>
                    </span>
                    <StatusBadge status={c.status as ComplaintStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <Link
            href="/staff/complaints"
            className="group flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--muted)]/30"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
              <ListChecks className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                Complaint Queue
              </span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                Everything assigned to your office
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>

          <Link
            href="/staff/sla"
            className="group flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--muted)]/30"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Timer className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--foreground)]">
                SLA Tracker
              </span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                Deadlines across your open cases
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}
