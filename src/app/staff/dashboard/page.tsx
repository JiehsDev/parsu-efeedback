// src/app/staff/dashboard/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ListChecks,
  Loader2,
  Timer,
  UserPlus,
} from "lucide-react";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatCard, StatChip, type StatCardData } from "@/components/shared/StatCard";
import {
  ComplaintListRow,
  ComplaintRowHeader,
  type ComplaintRowData,
} from "@/components/shared/ComplaintListRow";

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
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
  const staffRef = new Types.ObjectId(session!.user.id);
  const firstName = session!.user.name?.split(" ")[0] ?? "there";
  const openStatusFilter = { $nin: ["resolved", "closed", "withdrawn"] as const };

  const [
    statusCounts,
    overdueCount,
    unassignedCount,
    unassignedPreview,
    myOpenCount,
    myOpenPreview,
  ] = await Promise.all([
    Complaint.aggregate([
      { $match: { assignedOfficeRef: officeRef, isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Complaint.countDocuments({
      assignedOfficeRef: officeRef,
      isOverdue: true,
      status: openStatusFilter,
    }),
    Complaint.countDocuments({
      assignedOfficeRef: officeRef,
      assignedStaffRef: null,
      status: openStatusFilter,
    }),
    Complaint.find({
      assignedOfficeRef: officeRef,
      assignedStaffRef: null,
      status: openStatusFilter,
      isArchived: false,
    })
      .sort({ slaResponseDueAt: 1 })
      .limit(5)
      .lean(),
    Complaint.countDocuments({
      assignedStaffRef: staffRef,
      status: openStatusFilter,
    }),
    Complaint.find({
      assignedStaffRef: staffRef,
      status: openStatusFilter,
      isArchived: false,
    })
      .sort({ slaResolutionDueAt: 1 })
      .limit(5)
      .lean(),
  ]);

  const countMap: Record<string, number> = Object.fromEntries(
    statusCounts.map((s: any) => [s._id, s.count]),
  );

  const STATS: StatCardData[] = [
    {
      label: "My Open Cases",
      value: myOpenCount,
      icon: Briefcase,
      iconColor: "var(--secondary)",
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
      href: "/staff/complaints?assignee=mine",
    },
    {
      label: "Unassigned",
      value: unassignedCount,
      icon: UserPlus,
      iconColor: "var(--qa-amber)",
      tint: "bg-amber-500/15 text-amber-400",
      chipBorder: "border-amber-500/30",
      chipBg: "bg-amber-500/10",
      chipText: "text-amber-400",
      href: "/staff/complaints",
      emphasize: unassignedCount > 0,
    },
    {
      label: "In Progress",
      value: countMap.in_progress ?? 0,
      icon: Loader2,
      iconColor: "var(--primary)",
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
      href: "/staff/complaints?status=in_progress",
    },
    {
      label: "Overdue",
      value: overdueCount,
      icon: AlertTriangle,
      iconColor: "var(--destructive)",
      tint: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
      chipBorder: "border-[var(--destructive)]/30",
      chipBg: "bg-[var(--destructive)]/10",
      chipText: "text-[var(--destructive)]",
      href: "/staff/sla",
      emphasize: overdueCount > 0,
    },
    {
      label: "Resolved",
      value: countMap.resolved ?? 0,
      icon: CheckCircle2,
      iconColor: "var(--qa-success)",
      tint: "bg-emerald-500/15 text-emerald-400",
      chipBorder: "border-emerald-500/30",
      chipBg: "bg-emerald-500/10",
      chipText: "text-emerald-400",
      href: "/staff/complaints?status=resolved",
    },
  ];

  const queueMessage =
    overdueCount > 0
      ? `${overdueCount} complaint${overdueCount === 1 ? " is" : "s are"} overdue in your office right now.`
      : unassignedCount > 0
        ? `${unassignedCount} complaint${unassignedCount === 1 ? "" : "s"} waiting to be claimed.`
        : "Your office queue is all caught up.";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            Hey, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">{queueMessage}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/staff/complaints"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50"
          >
            <ListChecks className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            Complaint Queue
          </Link>
          <Link
            href="/staff/sla"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50"
          >
            <Timer className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            SLA Tracker
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:hidden">
        {STATS.map((stat) => (
          <StatChip key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardQueuePanel
          title="My cases"
          description="Assigned to you, soonest resolution deadline first."
          complaints={myOpenPreview}
          hrefPrefix="/staff/complaints"
          emptyIcon={CheckCircle2}
          emptyTitle="Nothing on your plate"
          emptyHint="Grab a complaint from the office queue to get started."
        />
        <DashboardQueuePanel
          title="Needs a claimant"
          description="Unassigned complaints, oldest first-response deadline first."
          complaints={unassignedPreview}
          hrefPrefix="/staff/complaints"
          emptyIcon={CheckCircle2}
          emptyTitle="All caught up"
          emptyHint="Nothing unassigned in your office right now."
        />
      </div>
    </div>
  );
}

function DashboardQueuePanel({
  title,
  description,
  complaints,
  hrefPrefix,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyHint,
}: {
  title: string;
  description: string;
  complaints: any[];
  hrefPrefix: string;
  emptyIcon: typeof CheckCircle2;
  emptyTitle: string;
  emptyHint: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-col gap-2 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
        </div>
        <Link
          href={hrefPrefix}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
        >
          View queue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {complaints.length === 0 ? (
        <div className="mx-6 my-5 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border)] py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <EmptyIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--foreground)]">{emptyTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{emptyHint}</p>
        </div>
      ) : (
        <div className="mt-4">
          <ComplaintRowHeader showTicket={false} />
          <ul className="divide-y divide-[var(--border)]">
            {complaints.map((c) => (
              <ComplaintListRow
                key={String(c._id)}
                complaint={c as ComplaintRowData}
                hrefPrefix={hrefPrefix}
                showTicket={false}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
