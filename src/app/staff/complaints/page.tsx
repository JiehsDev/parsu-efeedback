// src/app/staff/complaints/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  ChevronRight,
  Inbox,
  ListChecks,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "@/lib/constants";
import { CopyButton } from "@/components/shared/CopyButton";
import { ListSearchInput } from "@/components/shared/ListSearchInput";
import { ListSortSelect } from "@/components/shared/ListSortSelect";
import { PRIORITY_FLAG } from "@/components/shared/ComplaintListRow";
import { StatCard, StatChip, type StatCardData } from "@/components/shared/StatCard";
import { escapeRegExp } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_information", label: "Pending Info" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
];

export default async function StaffComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; assignee?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();
  const { status: statusParam, q, sort, assignee } = await searchParams;
  const status = COMPLAINT_STATUSES.find((s) => s === statusParam);
  const search = q?.trim();
  const sortOrder = sort === "oldest" ? 1 : -1;
  const mine = assignee === "mine";

  const baseFilter = { assignedOfficeRef: session!.user.officeRef, isArchived: false };

  const [complaints, unassignedCount, overdueCount, myAssignedCount, totalCount] =
    await Promise.all([
      Complaint.find({
        ...baseFilter,
        ...(status ? { status } : {}),
        ...(mine ? { assignedStaffRef: session!.user.id } : {}),
        ...(search
          ? {
              $or: [
                { title: { $regex: escapeRegExp(search), $options: "i" } },
                { ticketNumber: { $regex: escapeRegExp(search), $options: "i" } },
              ],
            }
          : {}),
      })
        .populate({
          // Student identity is kept out of the staff view — ID + college
          // only, not name, so a complaint reads a little more anonymous.
          path: "studentRef",
          select: "employeeOrStudentId collegeRef",
          populate: { path: "collegeRef", select: "name" },
        })
        .sort({ createdAt: sortOrder })
        .lean(),
      Complaint.countDocuments({
        ...baseFilter,
        assignedStaffRef: null,
        status: { $nin: ["resolved", "closed", "withdrawn"] },
      }),
      Complaint.countDocuments({ ...baseFilter, isOverdue: true }),
      Complaint.countDocuments({ ...baseFilter, assignedStaffRef: session!.user.id }),
      Complaint.countDocuments(baseFilter),
    ]);

  const STATS: StatCardData[] = [
    {
      label: "Assigned to Me",
      value: myAssignedCount,
      icon: Briefcase,
      iconColor: "var(--secondary)",
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
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
      label: "Total",
      value: totalCount,
      icon: ListChecks,
      iconColor: "var(--primary)",
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
  ];

  function buildHref(overrides: { status?: string; assignee?: string }) {
    const params = new URLSearchParams();
    const nextStatus = overrides.status ?? (status ?? "");
    const nextAssignee = overrides.assignee ?? (mine ? "mine" : "");
    if (nextStatus) params.set("status", nextStatus);
    if (nextAssignee) params.set("assignee", nextAssignee);
    if (search) params.set("q", search);
    if (sort) params.set("sort", sort);
    return params.toString() ? `/staff/complaints?${params}` : "/staff/complaints";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Complaint Queue
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Everything routed to your office.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:hidden">
        {STATS.map((stat) => (
          <StatChip key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense fallback={<div className="h-11 w-full max-w-xs" />}>
          <ListSearchInput placeholder="Search by title or ticket number…" className="max-w-xs" />
        </Suspense>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={buildHref({ assignee: mine ? "" : "mine" })}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
              mine
                ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]/50"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Assigned to me
          </Link>
          <Suspense fallback={<div className="h-11 w-40" />}>
            <ListSortSelect options={SORT_OPTIONS} />
          </Suspense>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 rounded-full bg-[var(--muted)]/50 p-1">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildHref({ status: f.value })}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              (status ?? "") === f.value
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {complaints.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No complaints match this filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {complaints.map((c: any) => {
              const flag = PRIORITY_FLAG[c.priority];
              return (
                <li key={c._id}>
                  <Link
                    href={`/staff/complaints/${c._id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--muted)]/40"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        c.assignedStaffRef
                          ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {c.assignedStaffRef ? (
                        <UserCheck className="h-[18px] w-[18px]" />
                      ) : (
                        <UserX className="h-[18px] w-[18px]" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--foreground)]">
                          {c.title}
                        </span>
                        {flag && (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${flag.className}`}
                          >
                            {flag.label}
                          </span>
                        )}
                        {c.isOverdue && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--destructive)]/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--destructive)] uppercase">
                            Overdue
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span className="inline-flex min-w-0 items-center gap-1 font-mono">
                          <span className="truncate">{c.ticketNumber}</span>
                          <CopyButton value={c.ticketNumber} />
                        </span>
                        <span className="hidden shrink-0 sm:inline">·</span>
                        <span className="hidden shrink-0 whitespace-nowrap sm:inline">
                          {c.assignedStaffRef ? "Assigned" : "Unassigned"}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                        {c.studentRef?.employeeOrStudentId ?? "—"}
                        {c.studentRef?.collegeRef?.name ? ` · ${c.studentRef.collegeRef.name}` : ""}
                      </span>
                    </span>

                    <StatusBadge status={c.status as ComplaintStatus} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
