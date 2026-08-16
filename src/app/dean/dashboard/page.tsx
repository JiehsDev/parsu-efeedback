// src/app/dean/dashboard/page.tsx
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Inbox, ListChecks } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { Types } from "mongoose";
import { getMonthlyTrends } from "@/features/analytics/services/analytics.service";
import { TrendChart } from "@/components/analytics/TrendChart";

export default async function DeanDashboardPage() {
  const session = await auth();
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

  const trends = await getMonthlyTrends({
    _id: { $in: collegeComplaintIds.map((c: any) => c._id) },
    isArchived: false,
  });

  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
  const total = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;
  const open =
    (countMap.submitted ?? 0) +
    (countMap.assigned ?? 0) +
    (countMap.in_progress ?? 0) +
    (countMap.pending_information ?? 0) +
    (countMap.escalated ?? 0);

  const STATS = [
    {
      label: "Total",
      value: total,
      icon: ListChecks,
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
    },
    {
      label: "Open",
      value: open,
      icon: Inbox,
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
    {
      label: "Escalated",
      value: countMap.escalated ?? 0,
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
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Dashboard</h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Overview of complaints across your college.
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

      <div
        role="region"
        aria-labelledby="dean-trend-heading"
        className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="dean-trend-heading" className="text-sm font-semibold text-[var(--foreground)]">
            Complaint Trend
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
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">Not enough data yet.</p>
        ) : (
          <div className="mt-4">
            <TrendChart data={trends} />
          </div>
        )}
      </div>
    </div>
  );
}
