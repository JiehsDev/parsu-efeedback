// src/app/student/complaints/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3, ClipboardList, Inbox, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "@/lib/constants";
import { CopyButton } from "@/components/shared/CopyButton";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { ListSearchInput } from "@/components/shared/ListSearchInput";
import { ListSortSelect } from "@/components/shared/ListSortSelect";
import { escapeRegExp } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--muted-foreground)]",
  medium: "bg-[var(--secondary)]",
  high: "bg-amber-400",
  critical: "bg-[var(--destructive)]",
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_information", label: "Pending Info" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default async function StudentComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; status?: string; q?: string; sort?: string }>;
}) {
  const session = await auth();
  await connectToDatabase();

  const { submitted, status: statusParam, q, sort } = await searchParams;
  const status = COMPLAINT_STATUSES.find((s) => s === statusParam);
  const search = q?.trim();
  const sortOrder = sort === "oldest" ? 1 : -1;

  const [allComplaints, filteredComplaints] = await Promise.all([
    Complaint.find({ studentRef: session!.user.id, isArchived: false })
      .select("status")
      .lean(),
    Complaint.find({
      studentRef: session!.user.id,
      isArchived: false,
      ...(status ? { status } : {}),
      ...(search
        ? {
            $or: [
              { title: { $regex: escapeRegExp(search), $options: "i" } },
              { ticketNumber: { $regex: escapeRegExp(search), $options: "i" } },
            ],
          }
        : {}),
    })
      .sort({ createdAt: sortOrder })
      .lean(),
  ]);

  const openStatuses = new Set([
    "submitted",
    "assigned",
    "in_progress",
    "pending_information",
    "escalated",
  ]);
  const openCount = allComplaints.filter((c: any) => openStatuses.has(c.status)).length;
  const resolvedCount = allComplaints.filter((c: any) =>
    ["resolved", "closed"].includes(c.status),
  ).length;

  return (
    <div className="space-y-6">
      {submitted && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Complaint <span className="font-mono font-medium">{submitted}</span> submitted
            successfully. We'll notify you as it progresses.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            My Complaints
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            Every issue you've filed, and where it stands.
          </p>
        </div>
        <Link
          href="/student/complaints/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Submit Complaint
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Inbox className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {openCount}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Open</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {resolvedCount}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Resolved</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
            <Clock3 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {allComplaints.length}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Total</p>
        </div>
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
          if (search) params.set("q", search);
          if (sort) params.set("sort", sort);
          const href = params.toString()
            ? `/student/complaints?${params}`
            : "/student/complaints";

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

      {filteredComplaints.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <ClipboardList className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            {status || search
              ? "No complaints match this filter."
              : "You haven't submitted any complaints yet."}
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {status || search
              ? "Try a different search or status, or view all."
              : "When something needs attention, it only takes a minute to file."}
          </p>
          <Link
            href={status || search ? "/student/complaints" : "/student/complaints/new"}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            {status || search ? "Clear filter" : <Plus className="h-4 w-4" />}
            {status || search ? "" : "Submit your first complaint"}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {filteredComplaints.map((c: any) => (
              <li key={c._id}>
                <Link
                  href={`/student/complaints/${c._id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--muted)]/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                      {c.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="inline-flex items-center gap-1 font-mono">
                        {c.ticketNumber}
                        <CopyButton value={c.ticketNumber} />
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[c.priority] ?? "bg-[var(--muted-foreground)]"}`}
                        />
                        {c.priority}
                      </span>
                      <span>·</span>
                      <RelativeTime date={c.createdAt} />
                    </span>
                  </span>
                  <StatusBadge status={c.status as ComplaintStatus} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
