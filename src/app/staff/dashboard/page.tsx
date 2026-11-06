import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Inbox,
  Timer,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintListRow, ComplaintRowHeader } from "@/components/shared/ComplaintListRow";
import { staffComplaintFilter, getStaffOffice } from "@/lib/osas-operations";

const OPEN_STATUSES = [
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
] as const;

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "office_staff") redirect("/dashboard");

  await connectToDatabase();
  const [scope, office] = await Promise.all([
    staffComplaintFilter(session),
    getStaffOffice(session),
  ]);
  const mine = { ...scope, assignedStaffRef: session.user.id, isArchived: false };
  const openMine = { ...mine, status: { $in: OPEN_STATUSES } };
  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [assignedCount, waitingCount, overdueCount, dueSoonCount, recent] = await Promise.all([
    Complaint.countDocuments(openMine),
    Complaint.countDocuments({ ...openMine, status: "pending_information" }),
    Complaint.countDocuments({
      ...openMine,
      $or: [
        { isOverdue: true },
        { status: "submitted", slaResponseDueAt: { $ne: null, $lte: now } },
        { status: { $ne: "submitted" }, slaResolutionDueAt: { $ne: null, $lte: now } },
      ],
    }),
    Complaint.countDocuments({
      ...openMine,
      $or: [
        { status: "submitted", slaResponseDueAt: { $gt: now, $lte: nextDay } },
        { status: { $ne: "submitted" }, slaResolutionDueAt: { $gt: now, $lte: nextDay } },
      ],
    }),
    Complaint.find(mine)
      .sort({ updatedAt: -1 })
      .limit(6)
      .select("title ticketNumber priority status updatedAt slaResponseDueAt slaResolutionDueAt isOverdue resolvedByRef")
      .populate("resolvedByRef", "firstName lastName")
      .lean(),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const officeLabel = office?.name ?? "your office";

  return (
    <div className="workspace-page space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)]">{officeLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your assigned work and the next steps for today.
          </p>
        </div>
        <Link
          href="/staff/complaints"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Inbox className="h-4 w-4" />
          Open office queue
        </Link>
      </header>

      <section aria-label="My workload" className="grid grid-cols-2 gap-px overflow-hidden border-y border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        <WorkloadCard label="Assigned to me" value={assignedCount} href="/staff/complaints?assignee=mine" icon={BriefcaseBusiness} />
        <WorkloadCard label="Waiting on student" value={waitingCount} href="/staff/complaints?assignee=mine&status=pending_information" icon={Inbox} />
        <WorkloadCard label="Overdue" value={overdueCount} href="/staff/complaints?assignee=mine&sla=overdue" icon={Clock3} urgent={overdueCount > 0} />
        <WorkloadCard label="Due within 24 hours" value={dueSoonCount} href="/staff/complaints?assignee=mine&sla=due" icon={Timer} />
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently assigned to you</h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Your latest complaint activity</p>
          </div>
          <Link
            href="/staff/complaints?assignee=mine"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recent.length ? (
          <>
            <ComplaintRowHeader />
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((complaint) => (
                <ComplaintListRow
                  key={String(complaint._id)}
                  complaint={complaint as any}
                  hrefPrefix="/staff/complaints"
                  showCopyButton={false}
                />
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">No complaints assigned to you yet</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Open the office queue or ask your office head to assign a complaint.
              </p>
            </div>
            <Link
              href="/staff/complaints"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]/50"
            >
              Go to queue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function WorkloadCard({
  label,
  value,
  href,
  icon: Icon,
  urgent = false,
}: {
  label: string;
  value: number;
  href: string;
  icon: typeof Inbox;
  urgent?: boolean;
}) {
  return (
    <Link href={href} className="group flex min-h-24 items-center gap-3 bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--muted)]/40">
      <Icon className={`h-4 w-4 shrink-0 ${urgent ? "text-[var(--qa-rose-strong)]" : "text-[var(--muted-foreground)]"}`} />
      <span className="min-w-0 flex-1 text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
      <span className={`qa-tabular text-2xl font-semibold tracking-tight ${urgent ? "text-[var(--qa-rose-strong)]" : "text-[var(--foreground)]"}`}>
        {value}
      </span>
    </Link>
  );
}
