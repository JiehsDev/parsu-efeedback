// src/app/qa/dashboard/page.tsx
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks, Star } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { getMonthlyTrends } from "@/features/analytics/services/analytics.service";
import { TrendChart } from "@/components/analytics/TrendChart";

const PRIORITY_TINT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function QaDashboardPage() {
  await connectToDatabase();

  const [statusCounts, overdueCount, avgRatingResult, priorityCounts, trends] = await Promise.all([
    Complaint.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Complaint.countDocuments({ isOverdue: true, status: { $nin: ["resolved", "closed"] } }),
    Complaint.aggregate([
      { $match: { studentRating: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: "$studentRating" }, count: { $sum: 1 } } },
    ]),
    Complaint.aggregate([
      { $match: { isArchived: false, status: { $nin: ["resolved", "closed"] } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    getMonthlyTrends({ isArchived: false }),
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
  const total = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;
  const resolved = (countMap.resolved ?? 0) + (countMap.closed ?? 0);
  const complianceRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const avgRating = avgRatingResult[0]?.avg ?? null;
  const ratingCount = avgRatingResult[0]?.count ?? 0;

  const priorityMap = Object.fromEntries(priorityCounts.map((p: any) => [p._id, p.count]));

  const STATS = [
    {
      label: "Total Complaints",
      value: total,
      icon: ListChecks,
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
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
      label: "Resolution Rate",
      value: `${complianceRate}%`,
      icon: CheckCircle2,
      tint: "bg-emerald-500/15 text-emerald-400",
      chipBorder: "border-emerald-500/30",
      chipBg: "bg-emerald-500/10",
      chipText: "text-emerald-400",
    },
    {
      label: "Avg. Rating",
      value: avgRating ? `${avgRating.toFixed(1)} / 5` : "—",
      hint: ratingCount > 0 ? `${ratingCount} ratings` : undefined,
      icon: Star,
      tint: "bg-amber-500/15 text-amber-400",
      chipBorder: "border-amber-500/30",
      chipBg: "bg-amber-500/10",
      chipText: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          QA Dashboard
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Institution-wide monitoring — read-only.
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
            {stat.hint && (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{stat.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div
        role="region"
        aria-labelledby="qa-trend-heading"
        className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="qa-trend-heading" className="text-sm font-semibold text-[var(--foreground)]">
            Complaint Trend
          </h2>
          <Link
            href="/qa/analytics"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Open Complaints by Priority
          </h2>
          <div className="mt-4 space-y-3">
            {["low", "medium", "high", "critical"].map((p) => {
              const count = priorityMap[p] ?? 0;
              const max = Math.max(1, ...["low", "medium", "high", "critical"].map((k) => priorityMap[k] ?? 0));
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs capitalize text-[var(--muted-foreground)]">
                    {p}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className={`h-full rounded-full ${PRIORITY_TINT[p]}`}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs font-semibold text-[var(--foreground)]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Status Breakdown</h2>
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {Object.entries(countMap).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between py-2.5 text-sm">
                <span className="capitalize text-[var(--foreground)]">
                  {status.replace("_", " ")}
                </span>
                <span className="font-semibold text-[var(--muted-foreground)]">
                  {count as number}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
