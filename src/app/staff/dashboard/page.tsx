import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Inbox,
  ListChecks,
  MoveUpRight,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { Office } from "@/models/Office";
import { getAnalyticsSummary } from "@/features/analytics/services/analytics.service";
import {
  ComplaintListRow,
  ComplaintRowHeader,
  type ComplaintRowData,
} from "@/components/shared/ComplaintListRow";

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();

  if (!session.user.officeRef) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--qa-amber-soft)] text-[var(--qa-amber-strong)]">
          <Building2 className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
          No office is assigned to this account.
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Contact an administrator.</p>
      </div>
    );
  }

  const officeRef = new Types.ObjectId(session.user.officeRef);
  const staffRef = new Types.ObjectId(session.user.id);
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const openStatusFilter = { $nin: ["resolved", "closed", "withdrawn"] as const };
  const [
    office,
    statusCounts,
    overdueCount,
    unassignedCount,
    unassignedPreview,
    myOpenCount,
    myOpenPreview,
    analyticsSummary,
  ] = await Promise.all([
    Office.findById(officeRef).select("name headUserRef").lean(),
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
    Complaint.countDocuments({ assignedStaffRef: staffRef, status: openStatusFilter }),
    Complaint.find({ assignedStaffRef: staffRef, status: openStatusFilter, isArchived: false })
      .sort({ slaResolutionDueAt: 1 })
      .limit(5)
      .lean(),
    getAnalyticsSummary({ assignedOfficeRef: officeRef }),
  ]);

  const countMap: Record<string, number> = Object.fromEntries(
    statusCounts.map((s: any) => [s._id, s.count]),
  );
  const openCount = Object.entries(countMap)
    .filter(([status]) => !["resolved", "closed", "withdrawn"].includes(status))
    .reduce((total, [, count]) => total + count, 0);
  const formatHours = (hours: number | null) => (hours === null ? "-" : `${hours}h`);
  const queueMessage =
    overdueCount > 0
      ? `${overdueCount} complaint${overdueCount === 1 ? " is" : "s are"} overdue in your office right now.`
      : unassignedCount > 0
        ? `${unassignedCount} complaint${unassignedCount === 1 ? "" : "s"} waiting to be claimed.`
        : "Your office queue is all caught up.";
  const isOfficeHead = String((office as any)?.headUserRef ?? "") === session.user.id;
  const officeHeadLabel = isOfficeHead ? "Office Head" : "Office Staff";
  const officeName = String((office as any)?.name ?? "Assigned office");
  const officeContextLabel = officeName.toLowerCase().includes("quality")
    ? "Quality Assurance Office Staff"
    : officeName;

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--primary)] uppercase">
            {officeHeadLabel} workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            Office operations
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Good morning, {firstName}. {queueMessage}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
            {officeContextLabel}
          </p>
          {isOfficeHead && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--primary)]">
              <Building2 className="h-3.5 w-3.5" />
              Office Head · higher-level escalation available
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/staff/complaints"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <ListChecks className="h-4 w-4 text-[var(--muted-foreground)]" />
            Open queue
          </Link>
          <Link
            href="/staff/sla"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--card)] transition-opacity hover:opacity-85"
          >
            <Timer className="h-4 w-4" />
            SLA review
          </Link>
        </div>
      </header>

      {overdueCount > 0 && (
        <Link
          href="/staff/sla"
          className="flex items-center justify-between gap-4 rounded-lg border border-[var(--qa-rose-soft)] bg-[var(--qa-rose-soft)] px-4 py-3 transition-colors hover:bg-[#f7dfe4]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--qa-rose-strong)]" />
            <span className="truncate text-sm font-medium text-[var(--qa-rose-strong)]">
              {overdueCount} open complaint{overdueCount === 1 ? "" : "s"} past the SLA deadline
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[var(--qa-rose-strong)] sm:flex">
            Review SLA <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      <section
        className="grid grid-cols-2 divide-x divide-[var(--border)] border-y border-[var(--border)] bg-[var(--card)] sm:grid-cols-4"
        aria-label="Queue summary"
      >
        <SummaryMetric label="Open queue" value={openCount} href="/staff/complaints" />
        <SummaryMetric
          label="My cases"
          value={myOpenCount}
          href="/staff/complaints?assignee=mine"
        />
        <SummaryMetric
          label="Unassigned"
          value={unassignedCount}
          href="/staff/complaints"
          tone={unassignedCount > 0 ? "warning" : "default"}
        />
        <SummaryMetric
          label="Resolved"
          value={countMap.resolved ?? 0}
          href="/staff/complaints?status=resolved"
          tone="success"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <DashboardQueuePanel
            title="My work"
            description="Your active cases, ordered by resolution deadline."
            complaints={myOpenPreview}
            hrefPrefix="/staff/complaints"
            emptyIcon={CheckCircle2}
            emptyTitle="No active cases"
            emptyHint="Claim a complaint from the office queue when you are ready."
          />
          <DashboardQueuePanel
            title="Office triage"
            description="Unassigned complaints waiting for an owner."
            complaints={unassignedPreview}
            hrefPrefix="/staff/complaints"
            emptyIcon={Inbox}
            emptyTitle="Queue is clear"
            emptyHint="There are no unassigned complaints in your office."
          />
        </div>
        <aside className="space-y-6">
          <section className="border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
                  SLA compliance
                </p>
                <p className="qa-tabular mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                  {analyticsSummary.slaComplianceRate}%
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Across your office
                </p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--qa-success-soft)] text-[var(--qa-success-strong)]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden bg-[var(--muted)]">
              <div
                className="h-full bg-[var(--qa-success)]"
                style={{
                  width: `${Math.min(100, Math.max(0, analyticsSummary.slaComplianceRate))}%`,
                }}
              />
            </div>
            <Link
              href="/staff/sla"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              View SLA tracker <MoveUpRight className="h-3.5 w-3.5" />
            </Link>
          </section>
          <section className="border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
              Response times
            </p>
            <div className="mt-4 divide-y divide-[var(--border)]">
              <MetricLine
                icon={Timer}
                label="Avg. first response"
                value={formatHours(analyticsSummary.averageFirstResponseHours)}
              />
              <MetricLine
                icon={Timer}
                label="Avg. resolution"
                value={formatHours(analyticsSummary.averageResolutionHours)}
              />
              <MetricLine icon={UserRound} label="In progress" value={countMap.in_progress ?? 0} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "warning" | "success";
}) {
  const valueClass =
    tone === "warning"
      ? "text-[var(--qa-amber-strong)]"
      : tone === "success"
        ? "text-[var(--qa-success-strong)]"
        : "text-[var(--foreground)]";
  return (
    <Link
      href={href}
      className="group px-4 py-4 transition-colors hover:bg-[var(--muted)]/45 sm:px-5"
    >
      <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className={`qa-tabular mt-1 text-2xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </p>
    </Link>
  );
}

function MetricLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Icon className="h-4 w-4 text-[var(--secondary)]" />
        {label}
      </span>
      <span className="qa-tabular text-sm font-semibold text-[var(--foreground)]">{value}</span>
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
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyHint: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
        </div>
        <Link
          href={hrefPrefix}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
        >
          View queue <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {complaints.length === 0 ? (
        <div className="mx-5 my-5 flex flex-col items-center rounded-lg border border-dashed border-[var(--border)] py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--qa-success-soft)] text-[var(--qa-success-strong)]">
            <EmptyIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--foreground)]">{emptyTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{emptyHint}</p>
        </div>
      ) : (
        <div>
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
