// src/app/dean/dashboard/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Inbox, ListChecks } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { Types } from "mongoose";
import {
  getMonthlyTrends,
  getCategoryBreakdown,
} from "@/features/analytics/services/analytics.service";
import { TrendChart } from "@/components/analytics/TrendChart";
import { QaBarList } from "@/components/qa/charts/QaBarList";
import { StatCard, StatChip, type StatCardData } from "@/components/shared/StatCard";

export default async function DeanDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();

  if (!session!.user.collegeRef) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
          No college is assigned to this account.
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Contact an administrator.</p>
      </div>
    );
  }
  const collegeRef = new Types.ObjectId(session!.user.collegeRef);

  const statusCounts = await Complaint.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "studentRef",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $match: { "student.collegeRef": collegeRef, isArchived: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const collegeComplaintIds = await Complaint.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "studentRef",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $match: { "student.collegeRef": collegeRef } },
    { $project: { _id: 1 } },
  ]);

  const scopeMatch = {
    _id: { $in: collegeComplaintIds.map((c: any) => c._id) },
    isArchived: false,
  };

  const [trends, categoryBreakdown] = await Promise.all([
    getMonthlyTrends(scopeMatch),
    getCategoryBreakdown(scopeMatch),
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
  const total = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;
  const open =
    (countMap.submitted ?? 0) +
    (countMap.assigned ?? 0) +
    (countMap.in_progress ?? 0) +
    (countMap.pending_information ?? 0) +
    (countMap.escalated ?? 0);

  const STATS: StatCardData[] = [
    {
      label: "Total",
      value: total,
      icon: ListChecks,
      iconColor: "var(--muted-foreground)",
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
    },
    {
      label: "Open",
      value: open,
      icon: Inbox,
      iconColor: "var(--primary)",
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
    {
      label: "Escalated",
      value: countMap.escalated ?? 0,
      icon: AlertTriangle,
      iconColor: "var(--destructive)",
      tint: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
      chipBorder: "border-[var(--destructive)]/30",
      chipBg: "bg-[var(--destructive)]/10",
      chipText: "text-[var(--destructive)]",
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
    },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Dashboard</h1>

      <div className="grid grid-cols-4 gap-1.5 sm:hidden">
        {STATS.map((stat) => (
          <StatChip key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="hidden gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} stat={stat} compact />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          role="region"
          aria-labelledby="dean-status-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="dean-status-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            Status breakdown
          </h2>
          <ul className="mt-2.5 max-h-50 divide-y divide-[var(--border)] overflow-y-auto">
            {Object.entries(countMap).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-[var(--foreground)] capitalize">
                  {status.replace("_", " ")}
                </span>
                <span className="qa-tabular font-semibold text-[var(--muted-foreground)]">
                  {count as number}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          role="region"
          aria-labelledby="dean-category-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="dean-category-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            By category
          </h2>
          {categoryBreakdown.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No data yet.</p>
          ) : (
            <div className="mt-3 max-h-50 overflow-y-auto pr-1">
              <QaBarList
                data={categoryBreakdown.map((c) => ({ label: c.category, value: c.volume }))}
                subject="category"
              />
            </div>
          )}
        </div>
      </div>

      <div
        role="region"
        aria-labelledby="dean-trend-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2
            id="dean-trend-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            Complaint trend
          </h2>
          <Link
            href="/dean/analytics"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            Full analytics
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {trends.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Not enough data yet.</p>
        ) : (
          <div className="mt-3 min-h-0 flex-1">
            <TrendChart data={trends} heightClassName="h-full" />
          </div>
        )}
      </div>
    </div>
  );
}
