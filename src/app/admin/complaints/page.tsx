// src/app/admin/complaints/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { Archive, Building2, Inbox } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";
import { CopyButton } from "@/components/shared/CopyButton";
import { ListSearchInput } from "@/components/shared/ListSearchInput";
import { ListSortSelect } from "@/components/shared/ListSortSelect";
import { escapeRegExp } from "@/lib/utils";
import { getAdminScope, complaintFilterForScope } from "@/lib/admin-scope";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string; sort?: string; archived?: string }>;
}) {
  await connectToDatabase();
  const session = await auth();
  const scope = getAdminScope(session!.user.role);
  const { status, priority, q, sort, archived } = await searchParams;
  const search = q?.trim();
  const sortOrder = sort === "oldest" ? 1 : -1;
  const showArchived = archived === "1";

  const filter: Record<string, unknown> = {
    isArchived: showArchived,
    ...(await complaintFilterForScope(scope)),
  };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (search) {
    filter.$or = [
      { title: { $regex: escapeRegExp(search), $options: "i" } },
      { ticketNumber: { $regex: escapeRegExp(search), $options: "i" } },
    ];
  }

  const complaints = await Complaint.find(filter)
    .populate("assignedOfficeRef", "name")
    .populate({
      // Student identity is kept out of the admin view — ID + college
      // only, not name, so a complaint reads a little more anonymous.
      path: "studentRef",
      select: "employeeOrStudentId collegeRef",
      populate: { path: "collegeRef", select: "name" },
    })
    .sort({ createdAt: sortOrder })
    .limit(200)
    .lean();

  function withParam(key: string, value: string | undefined) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (search) params.set("q", search);
    if (sort) params.set("sort", sort);
    if (archived) params.set("archived", archived);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    return qs ? `/admin/complaints?${qs}` : "/admin/complaints";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {showArchived ? "Archived Complaints" : "All Complaints"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            {scope.kind === "college_office"
              ? "College offices"
              : scope.kind === "university_office"
                ? "University offices"
                : scope.kind === "student"
                  ? "All complaints"
                  : "Institution-wide"}
            . {complaints.length} shown.
          </p>
        </div>
        <Link
          href={
            showArchived
              ? withParam("archived", undefined)
              : `/admin/complaints?archived=1`
          }
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
            showArchived
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <Archive className="h-4 w-4" />
          {showArchived ? "Back to Active" : "View Archived"}
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense fallback={<div className="h-11 w-full max-w-xs" />}>
          <ListSearchInput placeholder="Search by title or ticket number…" className="max-w-xs" />
        </Suspense>
        <Suspense fallback={<div className="h-11 w-40" />}>
          <ListSortSelect options={SORT_OPTIONS} />
        </Suspense>
      </div>

      {!showArchived && (
        <div className="flex flex-wrap items-center gap-0.5 rounded-full bg-[var(--muted)]/50 p-1">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={withParam("status", f.value || undefined)}
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
      )}

      {complaints.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            {showArchived ? "No archived complaints." : "No complaints match this filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {complaints.map((c: any) => (
              <li key={c._id}>
                <Link
                  href={`/admin/complaints/${c._id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--muted)]/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">
                        {c.title}
                      </span>
                      {c.isOverdue && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--destructive)]/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--destructive)] uppercase">
                          Overdue
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="inline-flex items-center gap-1 font-mono">
                        {c.ticketNumber}
                        <CopyButton value={c.ticketNumber} />
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {c.assignedOfficeRef?.name ?? "—"}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[c.priority] ?? "bg-[var(--muted-foreground)]"}`}
                        />
                        {c.priority}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                      {c.studentRef?.employeeOrStudentId ?? "—"}
                      {c.studentRef?.collegeRef?.name ? ` · ${c.studentRef.collegeRef.name}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={c.status as ComplaintStatus} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
