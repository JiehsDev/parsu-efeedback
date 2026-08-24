// src/app/admin/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Route,
  Timer,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Complaint } from "@/models/Complaint";
import { Category } from "@/models/Category";
import { RoutingRule } from "@/models/RoutingRule";
import { SLARule } from "@/models/SLARule";
import { Office } from "@/models/Office";
import { AuditLog } from "@/models/AuditLog";
import {
  getMonthlyTrends,
  getSlaComplianceByOffice,
} from "@/features/analytics/services/analytics.service";
import { getSettings } from "@/features/settings/services/settings.service";
import { isR2Configured } from "@/lib/r2";
import { isResendConfigured } from "@/lib/resend";
import { isRedisConfigured } from "@/lib/rate-limit";
import { QaTrendChart } from "@/components/qa/charts/QaTrendChart";
import { QaDonutChart } from "@/components/qa/charts/QaDonutChart";
import { QaBarList } from "@/components/qa/charts/QaBarList";
import { SlaHeatmap } from "@/components/qa/SlaHeatmap";
import { StatCard, StatChip, type StatCardData } from "@/components/shared/StatCard";
import { RelativeTime } from "@/components/shared/RelativeTime";

const SLA_CRON_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const ROLE_LABELS: Record<string, string> = {
  student: "Students",
  office_staff: "Staff",
  college_dean: "Deans",
  qa_office: "QA Office",
  administrator: "Admins",
};

const ROLE_COLORS = [
  "var(--primary)",
  "var(--secondary)",
  "var(--qa-amber)",
  "var(--qa-rose)",
  "var(--qa-slate)",
];

export default async function AdminDashboardPage() {
  await connectToDatabase();

  const scopeMatch = { isArchived: false };
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    userCount,
    inactiveUsers,
    openComplaints,
    overdueComplaints,
    unroutedComplaints,
    unassignedComplaints,
    staleSubmitted,
    trends,
    slaByOffice,
    roleCounts,
    recentActivity,
    activeCategories,
    activeRoutingRules,
    activeSlaRules,
    activeOffices,
    staffByOffice,
    officeWorkload,
    settings,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: false }),
    Complaint.countDocuments({ ...scopeMatch, status: { $nin: ["resolved", "closed"] } }),
    Complaint.countDocuments({
      ...scopeMatch,
      isOverdue: true,
      status: { $nin: ["resolved", "closed"] },
    }),
    Complaint.countDocuments({
      ...scopeMatch,
      assignedOfficeRef: null,
      status: { $nin: ["resolved", "closed"] },
    }),
    Complaint.countDocuments({
      ...scopeMatch,
      assignedOfficeRef: { $ne: null },
      assignedStaffRef: null,
      status: { $nin: ["resolved", "closed"] },
    }),
    Complaint.countDocuments({ ...scopeMatch, status: "submitted", createdAt: { $lt: dayAgo } }),
    getMonthlyTrends(scopeMatch),
    getSlaComplianceByOffice(),
    User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("actorRef", "firstName lastName")
      .lean(),
    Category.find({ isActive: true }).select("name").lean(),
    RoutingRule.find({ isActive: true }).select("categoryRef").lean(),
    SLARule.find({ isActive: true }).select("categoryRef").lean(),
    Office.find({ type: "service_office", isActive: true }).select("name").lean(),
    User.aggregate([
      { $match: { role: "office_staff", isActive: true, officeRef: { $ne: null } } },
      { $group: { _id: "$officeRef", count: { $sum: 1 } } },
    ]),
    Complaint.aggregate([
      {
        $match: {
          ...scopeMatch,
          status: { $nin: ["resolved", "closed"] },
          assignedOfficeRef: { $ne: null },
        },
      },
      {
        $lookup: {
          from: "offices",
          localField: "assignedOfficeRef",
          foreignField: "_id",
          as: "office",
        },
      },
      { $unwind: "$office" },
      { $group: { _id: "$office.name", volume: { $sum: 1 } } },
      { $sort: { volume: -1 } },
      { $limit: 8 },
    ]),
    getSettings(),
  ]);

  const STATS: StatCardData[] = [
    {
      label: "Active Users",
      value: userCount,
      icon: Users,
      iconColor: "var(--secondary)",
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
    },
    {
      label: "Open Complaints",
      value: openComplaints,
      icon: Inbox,
      iconColor: "var(--primary)",
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
    {
      label: "Overdue",
      value: overdueComplaints,
      icon: AlertTriangle,
      iconColor: "var(--destructive)",
      tint: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
      chipBorder: "border-[var(--destructive)]/30",
      chipBg: "bg-[var(--destructive)]/10",
      chipText: "text-[var(--destructive)]",
    },
    {
      label: "Unrouted",
      value: unroutedComplaints,
      icon: Route,
      iconColor: "var(--qa-amber)",
      tint: "bg-amber-500/15 text-amber-400",
      chipBorder: "border-amber-500/30",
      chipBg: "bg-amber-500/10",
      chipText: "text-amber-400",
    },
    {
      label: "Unassigned",
      value: unassignedComplaints,
      icon: Timer,
      iconColor: "var(--qa-rose)",
      tint: "bg-rose-500/15 text-rose-400",
      chipBorder: "border-rose-500/30",
      chipBg: "bg-rose-500/10",
      chipText: "text-rose-400",
    },
    {
      label: "Inactive Accounts",
      value: inactiveUsers,
      icon: UserX,
      iconColor: "var(--muted-foreground)",
      tint: "bg-[var(--muted)] text-[var(--muted-foreground)]",
      chipBorder: "border-[var(--border)]",
      chipBg: "bg-[var(--muted)]/40",
      chipText: "text-[var(--muted-foreground)]",
    },
  ];

  const routedCategoryIds = new Set(activeRoutingRules.map((r: any) => String(r.categoryRef)));
  const hasDefaultSlaRule = activeSlaRules.some((r: any) => r.categoryRef === null);
  const slaCoveredCategoryIds = new Set(
    activeSlaRules.filter((r: any) => r.categoryRef !== null).map((r: any) => String(r.categoryRef)),
  );
  const staffedOfficeIds = new Set(staffByOffice.map((s: any) => String(s._id)));

  const categoriesMissingRouting = activeCategories.filter(
    (c: any) => !routedCategoryIds.has(String(c._id)),
  );
  const categoriesMissingSla = hasDefaultSlaRule
    ? []
    : activeCategories.filter((c: any) => !slaCoveredCategoryIds.has(String(c._id)));
  const officesMissingStaff = activeOffices.filter((o: any) => !staffedOfficeIds.has(String(o._id)));

  const lastSlaCheckAt = (settings as any).lastSlaCheckAt as Date | null;
  const slaCronIsFresh =
    lastSlaCheckAt !== null && Date.now() - new Date(lastSlaCheckAt).getTime() < SLA_CRON_STALE_AFTER_MS;

  const CHECKS: {
    label: string;
    ok: boolean;
    detail: string;
    href?: string;
  }[] = [
    {
      label: "Routing rules",
      ok: categoriesMissingRouting.length === 0,
      detail:
        categoriesMissingRouting.length === 0
          ? `All ${activeCategories.length} categories have a routing rule`
          : `${categoriesMissingRouting.length} categor${categoriesMissingRouting.length === 1 ? "y has" : "ies have"} no routing rule`,
      href: "/admin/categories",
    },
    {
      label: "SLA rules",
      ok: categoriesMissingSla.length === 0,
      detail:
        categoriesMissingSla.length === 0
          ? "All categories covered by an SLA rule"
          : `${categoriesMissingSla.length} categor${categoriesMissingSla.length === 1 ? "y has" : "ies have"} no SLA rule`,
      href: "/admin/sla-rules",
    },
    {
      label: "Office staffing",
      ok: officesMissingStaff.length === 0,
      detail:
        officesMissingStaff.length === 0
          ? "Every active office has staff"
          : `${officesMissingStaff.length} office${officesMissingStaff.length === 1 ? "" : "s"} with no active staff`,
      href: "/admin/offices",
    },
    {
      label: "Routing backlog",
      ok: staleSubmitted === 0,
      detail:
        staleSubmitted === 0
          ? "No complaints waiting over 24h"
          : `${staleSubmitted} complaint${staleSubmitted === 1 ? "" : "s"} unrouted over 24h`,
      href: "/admin/reports",
    },
    {
      label: "Email delivery",
      ok: isResendConfigured(),
      detail: isResendConfigured()
        ? "Resend is configured for outgoing email"
        : "Resend is not configured — students won't receive email notifications",
    },
    {
      label: "File storage",
      ok: isR2Configured(),
      detail: isR2Configured()
        ? "Cloudflare R2 is configured for attachments"
        : "R2 is not configured — file uploads will fail",
    },
    {
      label: "Rate limiting",
      ok: isRedisConfigured(),
      detail: isRedisConfigured()
        ? "Upstash Redis is configured"
        : "Redis is not configured — login/API rate limiting is disabled",
    },
    {
      label: "SLA monitoring cron",
      ok: slaCronIsFresh,
      detail:
        lastSlaCheckAt === null
          ? "Has never run"
          : slaCronIsFresh
            ? `Last checked ${new Date(lastSlaCheckAt).toLocaleString()}`
            : `Stale — last checked ${new Date(lastSlaCheckAt).toLocaleString()}, expected hourly`,
    },
  ];

  const roleData = roleCounts
    .map((r: any, i: number) => ({
      label: ROLE_LABELS[r._id as string] ?? r._id,
      value: r.count,
      color: ROLE_COLORS[i % ROLE_COLORS.length]!,
    }))
    .sort((a, b) => b.value - a.value);

  const officeWorkloadData = officeWorkload.map((o: any) => ({ label: o._id, value: o.volume }));

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Admin Dashboard</h1>

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

      {/* CONFIG HEALTH (wide) · USER ROLES · RECENT ACTIVITY */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          role="region"
          aria-labelledby="admin-health-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 xl:col-span-2"
        >
          <h2
            id="admin-health-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            Configuration health
          </h2>
          <ul className="mt-2.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {CHECKS.map((check) => {
              const rowContent = (
                <>
                  {check.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-[var(--destructive)]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[var(--foreground)]">
                      {check.label}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
                      {check.detail}
                    </span>
                  </span>
                  {check.href && (
                    <ArrowRight className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                  )}
                </>
              );

              return (
                <li key={check.label}>
                  {check.href ? (
                    <Link
                      href={check.href}
                      className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-[var(--muted)]/50"
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                      {rowContent}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div
          role="region"
          aria-labelledby="admin-roles-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="admin-roles-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            Users by role
          </h2>
          {roleData.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No data yet.</p>
          ) : (
            <QaDonutChart data={roleData} centerLabel="active" subject="role" />
          )}
        </div>

        <div
          role="region"
          aria-labelledby="admin-activity-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="admin-activity-heading"
              className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
            >
              Recent activity
            </h2>
            <Link
              href="/admin/audit-logs"
              className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-[var(--primary)] hover:underline"
            >
              Full
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No activity yet.</p>
          ) : (
            <ul className="mt-2.5 max-h-50 divide-y divide-[var(--border)] overflow-y-auto">
              {recentActivity.map((log: any) => (
                <li key={String(log._id)} className="py-1.5">
                  <p className="truncate font-mono text-[10.5px] font-medium text-[var(--foreground)]">
                    {log.action}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <span className="truncate">
                      {log.actorRef
                        ? `${log.actorRef.firstName} ${log.actorRef.lastName}`
                        : "System"}
                    </span>
                    <span>·</span>
                    <RelativeTime date={log.createdAt} className="shrink-0" />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* SLA HEATMAP · TREND (wide) · OFFICE WORKLOAD */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          role="region"
          aria-labelledby="admin-sla-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="admin-sla-heading"
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
          aria-labelledby="admin-trend-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 xl:col-span-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="admin-trend-heading"
              className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
            >
              Complaint trend
            </h2>
            <Link
              href="/admin/reports"
              className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-[var(--primary)] hover:underline"
            >
              Reports
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          {trends.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">Not enough data yet.</p>
          ) : (
            <div className="mt-1 h-[calc(100%-1.5rem)]">
              <QaTrendChart data={trends} />
            </div>
          )}
        </div>

        <div
          role="region"
          aria-labelledby="admin-workload-heading"
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2
            id="admin-workload-heading"
            className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
          >
            Office workload
          </h2>
          {officeWorkloadData.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">No open complaints.</p>
          ) : (
            <div className="mt-3">
              <QaBarList data={officeWorkloadData} subject="office" color="var(--secondary)" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
