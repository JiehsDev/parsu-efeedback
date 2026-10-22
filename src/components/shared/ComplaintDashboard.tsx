import Link from "next/link";
import {
  ArrowUpRight,
  AlertCircle,
  Clock3,
  CheckCircle2,
  Inbox,
  Users,
  Timer,
  Star,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { redirect } from "next/navigation";
import { Complaint } from "@/models/Complaint";
import { getAdminScope, complaintFilterForScope } from "@/lib/admin-scope";
import { staffComplaintFilter, isOversightRole, refId } from "@/lib/osas-operations";
import {
  getAnalyticsSummary,
  getMonthlyTrends,
  getCategoryBreakdown,
  getPriorityBreakdown,
  getDomainBreakdown,
} from "@/features/analytics/services/analytics.service";
import { QaTrendChart } from "@/components/analytics/QaTrendChart";
import { CategoryBarChart } from "@/components/analytics/CategoryBarChart";
import { PriorityPieChart } from "@/components/analytics/PriorityPieChart";
import { StatusBadge } from "./StatusBadge";

export async function ComplaintDashboard({ base }: { base: "admin" | "staff" }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const oversight = isOversightRole(session.user.role);
  const filter =
    base === "staff"
      ? await staffComplaintFilter(session)
      : await complaintFilterForScope(getAdminScope(session.user.role));
  const open = {
    ...filter,
    isArchived: false,
    status: { $nin: ["closed", "resolved", "withdrawn"] as const },
  };
  const now = new Date();
  const nextDay = new Date(now.getTime() + 86400000);
  const [
    summary,
    trends,
    openCount,
    overdue,
    unassigned,
    dueSoon,
    queue,
    categories,
    priorities,
    domains,
  ] = await Promise.all([
    getAnalyticsSummary(filter),
    getMonthlyTrends(filter),
    Complaint.countDocuments(open),
    Complaint.countDocuments({
      ...open,
      $or: [
        { isOverdue: true },
        { assignedStaffRef: null, slaResponseDueAt: { $ne: null, $lte: now } },
        { assignedStaffRef: { $ne: null }, slaResolutionDueAt: { $ne: null, $lte: now } },
      ],
    }),
    Complaint.countDocuments({ ...open, assignedStaffRef: null }),
    Complaint.countDocuments({
      ...open,
      $or: [
        { assignedStaffRef: null, slaResponseDueAt: { $gt: now, $lte: nextDay } },
        { assignedStaffRef: { $ne: null }, slaResolutionDueAt: { $gt: now, $lte: nextDay } },
      ],
    }),
    Complaint.find(open)
      .sort({ isOverdue: -1, slaResolutionDueAt: 1, submittedAt: 1 })
      .limit(6)
      .select(
        "ticketNumber title status priority isOverdue assignedStaffRef slaResponseDueAt slaResolutionDueAt",
      )
      .lean(),
    getCategoryBreakdown({ ...filter, isArchived: false }),
    getPriorityBreakdown({ ...filter, isArchived: false }),
    getDomainBreakdown(filter),
  ]);
  const panel = "min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4";
  const metrics = [
    { label: "Overdue", value: overdue, icon: AlertCircle, urgent: overdue > 0 },
    { label: "Unassigned", value: unassigned, icon: Users, urgent: false },
    { label: "Due within 24 hours", value: dueSoon, icon: Clock3, urgent: false },
    {
      label: "First response",
      value:
        summary.averageFirstResponseHours === null
          ? "N/A"
          : `${summary.averageFirstResponseHours}h`,
      icon: Timer,
      urgent: false,
    },
    {
      label: "Resolution time",
      value: summary.averageResolutionHours === null ? "N/A" : `${summary.averageResolutionHours}h`,
      icon: CheckCircle2,
      urgent: false,
    },
    {
      label: "Satisfaction",
      value: summary.averageRating === null ? "N/A" : `${summary.averageRating}/5`,
      icon: Star,
      urgent: false,
    },
  ];
  const domainTotal = domains.reduce((total, row) => total + row.volume, 0);
  const dateFormat = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {oversight
              ? `${session.user.role.toUpperCase()} oversight`
              : session.user.role === "administrator"
                ? "System overview"
                : "OSAS dashboard"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {oversight
              ? "Monitor open complaints and service deadlines."
              : "See what needs attention and pick up your next action."}
          </p>
        </div>
        <Link
          href={`/${base}/reports`}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--accent)]"
        >
          Reports <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12">
        <section className="col-span-2 flex flex-col justify-between rounded-2xl bg-[var(--primary)] p-4 text-[var(--primary-foreground)] lg:col-span-3 lg:row-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium opacity-90">Open complaints</h2>
            <Inbox className="h-4 w-4 opacity-75" aria-hidden="true" />
          </div>
          <p className="my-3 text-4xl font-semibold tracking-tight tabular-nums">{openCount}</p>
          <Link
            href={`/${base}/complaints`}
            className="flex items-center justify-between border-t border-current/20 pt-2 text-xs font-medium hover:underline"
          >
            View complaint queue <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>

        <section
          className={`${panel} col-span-2 flex flex-col justify-between lg:col-span-3 lg:row-span-2`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs text-[var(--muted-foreground)]">SLA compliance</h2>
            <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          </div>
          <p className="my-3 text-4xl font-semibold tracking-tight tabular-nums">
            {summary.resolvedComplaints ? (
              <>
                {summary.slaComplianceRate}
                <span className="ml-0.5 text-xl text-[var(--muted-foreground)]">%</span>
              </>
            ) : (
              <span className="text-2xl">N/A</span>
            )}
          </p>
          <div>
            <div
              role="meter"
              aria-label="SLA compliance"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.slaComplianceRate}
              className="h-1.5 overflow-hidden rounded-full bg-[var(--accent)]"
            >
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.min(100, Math.max(0, summary.slaComplianceRate))}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
              Resolved within the service deadline
            </p>
          </div>
        </section>

        {metrics.map(({ label, value, icon: Icon, urgent }) => (
          <section
            key={label}
            className={`${panel} flex min-h-[76px] flex-col justify-between lg:col-span-2`}
          >
            <div className="flex items-center justify-between gap-1">
              <h2 className="text-[11px] text-[var(--muted-foreground)]">{label}</h2>
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${urgent ? "text-[var(--qa-rose-strong)]" : "text-[var(--muted-foreground)]"}`}
                aria-hidden="true"
              />
            </div>
            <p
              className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${urgent ? "text-[var(--qa-rose-strong)]" : ""}`}
            >
              {value}
            </p>
          </section>
        ))}

        <section
          className={`${panel} col-span-2 flex h-[260px] flex-col sm:col-span-4 lg:col-span-7`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Complaint trends</h2>
            <span className="text-[10px] text-[var(--muted-foreground)]">Monthly activity</span>
          </div>
          <div className="min-h-0 flex-1">
            {trends.length ? (
              <QaTrendChart data={trends} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl bg-[var(--background)] px-4 text-center text-xs text-[var(--muted-foreground)]">
                Trends will appear as complaints come in.
              </div>
            )}
          </div>
        </section>

        <section
          className={`${panel} col-span-2 flex h-[260px] flex-col sm:col-span-4 lg:col-span-5`}
          aria-labelledby="dashboard-queue-title"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <h2 id="dashboard-queue-title" className="text-sm font-semibold">
                {oversight ? "Open complaints" : "Action queue"}
              </h2>
              <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                {unassigned > 0 ? `${unassigned} awaiting assignment. ` : ""}Earliest deadlines
                first.
              </p>
            </div>
            <Link
              href={`/${base}/complaints`}
              className="shrink-0 text-[11px] font-medium text-[var(--primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {queue.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {queue.map((complaint) => {
                  const deadline = complaint.assignedStaffRef
                    ? complaint.slaResolutionDueAt
                    : complaint.slaResponseDueAt;
                  const late = complaint.isOverdue || (deadline && deadline <= now);
                  return (
                    <li key={refId(complaint._id)}>
                      <Link
                        href={`/${base}/complaints/${refId(complaint._id)}`}
                        className="group flex items-center justify-between gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-[var(--accent)]/50 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                      >
                        <span className="min-w-0">
                          <span className="block text-[10px] text-[var(--muted-foreground)]">
                            {complaint.ticketNumber}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-xs font-medium group-hover:text-[var(--primary)]"
                            title={complaint.title}
                          >
                            {complaint.title}
                          </span>
                          <span
                            className={`mt-0.5 block text-[10px] ${late ? "text-[var(--qa-rose-strong)]" : "text-[var(--muted-foreground)]"}`}
                          >
                            {late ? "Overdue" : "Due"}
                            {deadline ? ` ${dateFormat.format(deadline)}` : " date not set"}
                          </span>
                        </span>
                        <span className="shrink-0">
                          <StatusBadge status={complaint.status} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-[var(--background)] px-4 text-center">
                <Inbox className="h-5 w-5 text-[var(--muted-foreground)]" aria-hidden="true" />
                <p className="text-xs text-[var(--muted-foreground)]">No open complaints.</p>
              </div>
            )}
          </div>
        </section>

        <section className={`${panel} col-span-2 sm:col-span-4 lg:col-span-5`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Top categories</h2>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {Math.min(5, categories.length)} of {categories.length}
            </span>
          </div>
          {categories.length ? (
            <CategoryBarChart data={categories.slice(0, 5)} heightClassName="h-[164px]" />
          ) : (
            <EmptyPanel message="No category data yet." />
          )}
        </section>

        <section className={`${panel} col-span-2 lg:col-span-4`}>
          <h2 className="mb-3 text-sm font-semibold">Service domains</h2>
          <div className="h-[160px] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {domains.map((row) => (
              <div key={row.domain}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate capitalize">{row.domain.replaceAll("_", " ")}</span>
                  <span className="font-semibold tabular-nums">{row.volume}</span>
                </div>
                <div className="h-1 rounded-full bg-[var(--accent)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]/70"
                    style={{ width: `${domainTotal ? (row.volume / domainTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {!domains.length && <EmptyPanel message="No service domain data yet." />}
          </div>
        </section>

        <section className={`${panel} col-span-2 lg:col-span-3`}>
          <h2 className="mb-2 text-sm font-semibold">Priority mix</h2>
          {priorities.length ? (
            <PriorityPieChart data={priorities} heightClassName="h-[164px]" />
          ) : (
            <EmptyPanel message="No priority data yet." />
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-[164px] items-center justify-center rounded-xl bg-[var(--background)] px-4 text-center text-xs text-[var(--muted-foreground)]">
      {message}
    </div>
  );
}
