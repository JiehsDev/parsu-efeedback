// src/app/qa/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ListChecks,
  ShieldCheck,
  Star,
  Timer,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import {
  getMonthlyTrends,
  getCategoryBreakdown,
  getPriorityBreakdown,
  getOfficeBreakdown,
  getCollegeComparison,
  getSlaComplianceByOffice,
} from "@/features/analytics/services/analytics.service";
import { QaTrendChart } from "@/components/qa/charts/QaTrendChart";
import { QaDonutChart } from "@/components/qa/charts/QaDonutChart";
import { QaBarList } from "@/components/qa/charts/QaBarList";
import { SlaHeatmap } from "@/components/qa/SlaHeatmap";
import { StatCard, StatChip, type StatCardData } from "@/components/shared/StatCard";

const PRIORITY_COLOR: Record<string, string> = {
  medium: "var(--primary)",
  low: "var(--secondary)",
  high: "var(--qa-amber)",
  critical: "var(--destructive)",
};

const OFFICE_COLORS = [
  "var(--primary)",
  "var(--secondary)",
  "var(--qa-amber)",
  "var(--qa-rose)",
  "var(--qa-slate)",
  "var(--border)",
];

export default async function QaDashboardPage() {
  await connectToDatabase();

  const scopeMatch = { isArchived: false };

  const [
    statusCounts,
    overdueCount,
    openCount,
    avgRatingResult,
    trends,
    categoryBreakdown,
    priorityBreakdown,
    officeBreakdown,
    collegeComparison,
    slaByOffice,
  ] = await Promise.all([
    Complaint.aggregate([
      { $match: scopeMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Complaint.countDocuments({
      ...scopeMatch,
      isOverdue: true,
      status: { $nin: ["resolved", "closed", "withdrawn"] },
    }),
    Complaint.countDocuments({ ...scopeMatch, status: { $nin: ["resolved", "closed", "withdrawn"] } }),
    Complaint.aggregate([
      { $match: { studentRating: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: "$studentRating" }, count: { $sum: 1 } } },
    ]),
    getMonthlyTrends(scopeMatch),
    getCategoryBreakdown(scopeMatch),
    getPriorityBreakdown(scopeMatch),
    getOfficeBreakdown(scopeMatch),
    getCollegeComparison(),
    getSlaComplianceByOffice(),
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
  const total = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;
  const resolved = (countMap.resolved ?? 0) + (countMap.closed ?? 0);
  const complianceRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const avgRating = avgRatingResult[0]?.avg ?? null;
  const ratingCount = avgRatingResult[0]?.count ?? 0;

  const overallSlaTotal = slaByOffice.reduce((sum, o) => sum + o.total, 0);
  const overallSlaCompliant = slaByOffice.reduce((sum, o) => sum + o.compliant, 0);
  const overallSlaPercent =
    overallSlaTotal > 0 ? Math.round((overallSlaCompliant / overallSlaTotal) * 100) : 0;

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
      label: "Open / active",
      value: openCount,
      icon: Timer,
      iconColor: "var(--primary)",
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
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
    },
    {
      label: "Resolution rate",
      value: `${complianceRate}%`,
      icon: CheckCircle2,
      iconColor: "var(--qa-success)",
      tint: "bg-emerald-500/15 text-emerald-400",
      chipBorder: "border-emerald-500/30",
      chipBg: "bg-emerald-500/10",
      chipText: "text-emerald-400",
    },
    {
      label: "SLA compliance",
      value: `${overallSlaPercent}%`,
      icon: ShieldCheck,
      iconColor: "var(--primary)",
      tint: "bg-sky-500/15 text-sky-400",
      chipBorder: "border-sky-500/30",
      chipBg: "bg-sky-500/10",
      chipText: "text-sky-400",
    },
    {
      label: "Avg. rating",
      value: avgRating ? avgRating.toFixed(1) : "—",
      hint: ratingCount > 0 ? `${ratingCount} ratings` : undefined,
      icon: Star,
      iconColor: "var(--qa-amber)",
      tint: "bg-amber-500/15 text-amber-400",
      chipBorder: "border-amber-500/30",
      chipBg: "bg-amber-500/10",
      chipText: "text-amber-400",
    },
  ];

  const priorityData = priorityBreakdown.map((p) => ({
    label: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
    value: p.volume,
    color: PRIORITY_COLOR[p.priority] ?? "var(--qa-slate)",
  }));

  const officeData = officeBreakdown.map((o, i) => ({
    label: o.office,
    value: o.volume,
    color: OFFICE_COLORS[i % OFFICE_COLORS.length]!,
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">QA Dashboard</h1>

      <div className="grid grid-cols-3 gap-1.5 sm:hidden">
        {STATS.map((stat) => (
          <StatChip key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="hidden gap-2.5 sm:grid sm:grid-cols-3 xl:grid-cols-6">
        {STATS.map((stat) => (
          <StatCard key={stat.label} stat={stat} compact />
        ))}
      </div>

      {/* DETAILS · PIE · PIE · BAR */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          role="region"
          aria-labelledby="qa-status-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="qa-status-heading"
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
          aria-labelledby="qa-priority-pie-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="qa-priority-pie-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            By priority
          </h2>
          {priorityData.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No data yet.</p>
          ) : (
            <QaDonutChart data={priorityData} centerLabel="total" subject="priority" />
          )}
        </div>

        <div
          role="region"
          aria-labelledby="qa-office-pie-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="qa-office-pie-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            By office
          </h2>
          {officeData.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No data yet.</p>
          ) : (
            <QaDonutChart data={officeData} centerLabel="offices" subject="office" />
          )}
        </div>

        <div
          role="region"
          aria-labelledby="qa-category-bar-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="qa-category-bar-heading"
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

      {/* MAPS (SLA heatmap) · LINE CHART (trend, wide) · BAR (college) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          role="region"
          aria-labelledby="qa-sla-heatmap-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="qa-sla-heatmap-heading"
              className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
            >
              SLA by office
            </h2>
            <Link
              href="/qa/sla-compliance"
              className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-[var(--primary)] hover:underline"
            >
              Full
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          <div className="mt-2.5">
            <SlaHeatmap data={slaByOffice} compact />
          </div>
        </div>

        <div
          role="region"
          aria-labelledby="qa-trend-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 xl:col-span-2"
        >
          <h2
            id="qa-trend-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            Complaint trend
          </h2>
          <div className="mt-1 h-[calc(100%-1.5rem)]">
            <QaTrendChart data={trends} />
          </div>
        </div>

        <div
          role="region"
          aria-labelledby="qa-college-bar-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="qa-college-bar-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            By college
          </h2>
          {collegeComparison.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No data yet.</p>
          ) : (
            <div className="mt-3">
              <QaBarList
                data={collegeComparison.map((c) => ({ label: c.college, value: c.volume }))}
                subject="college"
                color="var(--secondary)"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
