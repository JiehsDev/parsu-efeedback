// src/app/qa/complaints/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { Building2, Inbox } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";
import { CopyButton } from "@/components/shared/CopyButton";
import { ListSearchInput } from "@/components/shared/ListSearchInput";
import { ListSortSelect } from "@/components/shared/ListSortSelect";
import { escapeRegExp } from "@/lib/utils";

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

export default async function QaComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string; sort?: string }>;
}) {
  await connectToDatabase();
  const { status, priority, q, sort } = await searchParams;
  const search = q?.trim();
  const sortOrder = sort === "oldest" ? 1 : -1;

  const filter: Record<string, unknown> = { isArchived: false };
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
    .sort({ createdAt: sortOrder })
    .limit(200)
    .lean();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          All Complaints
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Institution-wide, read-only. {complaints.length} shown.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense fallback={<div className="h-11 w-full max-w-xs" />}>
          <ListSearchInput placeholder="Search by title or ticket number…" className="max-w-xs" />
        </Suspense>
        <Suspense fallback={<div className="h-11 w-40" />}>
          <ListSortSelect options={SORT_OPTIONS} />
        </Suspense>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 rounded-full bg-[var(--muted)]/50 p-1">
        {STATUS_FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.value) params.set("status", f.value);
          if (priority) params.set("priority", priority);
          if (search) params.set("q", search);
          if (sort) params.set("sort", sort);
          const href = params.toString() ? `/qa/complaints?${params}` : "/qa/complaints";

          return (
            <Link
              key={f.value}
              href={href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                (status ?? "") === f.value
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
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
            {complaints.map((c: any) => (
              <li key={c._id} className="flex items-center gap-4 px-5 py-4">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--foreground)]">
                      {c.title}
                    </span>
                    {c.isOverdue && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--destructive)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--destructive)]">
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
                </span>
                <StatusBadge status={c.status as ComplaintStatus} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
