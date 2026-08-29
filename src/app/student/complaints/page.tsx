// src/app/student/complaints/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Plus, X } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "@/lib/constants";
import {
  ComplaintListRow,
  ComplaintRowHeader,
  DONE_STATUSES,
  OPEN_STATUSES,
  type ComplaintRowData,
} from "@/components/shared/ComplaintListRow";
import { ListSearchInput } from "@/components/shared/ListSearchInput";
import { ListSortSelect } from "@/components/shared/ListSortSelect";
import { escapeRegExp } from "@/lib/utils";

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated", label: "Recently updated" },
];

const SORT_ORDERS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
};

// Students think in "still waiting" vs "done", not in the seven-state
// lifecycle BR-041 defines, so the primary control is that two-way split.
// The status select is a second, narrower pass *inside* the active tab —
// it only ever offers statuses that exist in that tab, so the two controls
// cannot be set to a contradictory pair that returns nothing.
const VIEWS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
] as const;

type View = (typeof VIEWS)[number]["value"];

const VIEW_STATUSES: Record<View, readonly ComplaintStatus[]> = {
  open: OPEN_STATUSES,
  resolved: DONE_STATUSES,
  all: COMPLAINT_STATUSES,
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  assigned: "Assigned",
  in_progress: "In Progress",
  pending_information: "Pending Info",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

export default async function StudentComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{
    submitted?: string;
    view?: string;
    status?: string;
    q?: string;
    sort?: string;
    due?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await connectToDatabase();

  const params = await searchParams;
  const { submitted, q } = params;

  const view: View = VIEWS.some((v) => v.value === params.view) ? (params.view as View) : "open";
  const viewStatuses = VIEW_STATUSES[view];

  // A status carried over from another tab (a stale bookmark, or the back
  // button) is ignored rather than obeyed — obeying it would render an empty
  // list under a tab whose own count says otherwise.
  const status = viewStatuses.find((s) => s === params.status);
  const search = q?.trim();
  const sort = params.sort && SORT_ORDERS[params.sort] ? params.sort : "newest";
  // Only meaningful for still-open work, so it is ignored under the Resolved
  // tab rather than silently returning nothing.
  const overdueOnly = params.due === "overdue" && view !== "resolved";

  const filter = {
    studentRef: session!.user.id,
    isArchived: false,
    status: status ? status : { $in: viewStatuses },
    ...(overdueOnly ? { isOverdue: true } : {}),
    ...(search
      ? {
          $or: [
            { title: { $regex: escapeRegExp(search), $options: "i" } },
            { ticketNumber: { $regex: escapeRegExp(search), $options: "i" } },
          ],
        }
      : {}),
  };

  const [allComplaints, matchCount] = await Promise.all([
    Complaint.find({ studentRef: session!.user.id, isArchived: false }).select("status").lean(),
    Complaint.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  // Clamped rather than trusted: ListSearchInput/ListSortSelect preserve every
  // other query param when they write theirs, so narrowing a filter while on
  // page 3 would otherwise strand the student on a blank page.
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);

  const complaints = await Complaint.find(filter)
    .select(
      "title ticketNumber priority status createdAt updatedAt slaResponseDueAt slaResolutionDueAt isOverdue",
    )
    .sort(SORT_ORDERS[sort])
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const counts: Record<View, number> = {
    open: allComplaints.filter((c) => (OPEN_STATUSES as readonly string[]).includes(c.status))
      .length,
    resolved: allComplaints.filter((c) =>
      (DONE_STATUSES as readonly string[]).includes(c.status),
    ).length,
    all: allComplaints.length,
  };

  const statusOptions = [
    { value: "", label: "Any status" },
    ...viewStatuses.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];

  function hrefFor(next: Partial<Record<string, string>>) {
    const sp = new URLSearchParams();
    const merged = {
      view,
      status: status ?? "",
      q: search ?? "",
      sort,
      due: overdueOnly ? "overdue" : "",
      page: "1",
      ...next,
    };
    if (merged.view && merged.view !== "open") sp.set("view", merged.view);
    if (merged.status) sp.set("status", merged.status);
    if (merged.q) sp.set("q", merged.q);
    if (merged.sort && merged.sort !== "newest") sp.set("sort", merged.sort);
    if (merged.due) sp.set("due", merged.due);
    if (merged.page && merged.page !== "1") sp.set("page", merged.page);
    return sp.toString() ? `/student/complaints?${sp}` : "/student/complaints";
  }

  const isFiltered = Boolean(status || search || overdueOnly) || view !== "open";
  const hasNone = allComplaints.length === 0;
  const firstRow = (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, matchCount);

  return (
    <div className="space-y-5">
      {submitted && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--qa-success)]/30 bg-[var(--qa-success-soft)] px-4 py-3 text-sm text-[var(--qa-success-strong)]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Complaint <span className="qa-mono font-medium">{submitted}</span> submitted. You&rsquo;ll
            get a notification when it&rsquo;s picked up.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          My Complaints
        </h1>
        <Link
          href="/student/complaints/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Submit Complaint
        </Link>
      </div>

      <nav
        className="flex items-center gap-5 border-b border-[var(--border)]"
        aria-label="Filter by state"
      >
        {VIEWS.map((v) => {
          const active = v.value === view;
          return (
            <Link
              key={v.value}
              href={hrefFor({ view: v.value, status: "", page: "1" })}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm transition-colors ${
                active
                  ? "border-[var(--primary)] font-medium text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {v.label}
              <span
                className={`qa-tabular rounded-full px-1.5 py-0.5 text-[11px] ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {counts[v.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Suspense fallback={<div className="h-10 w-full sm:max-w-xs" />}>
            <ListSearchInput placeholder="Search title or ticket number" className="sm:max-w-xs" />
          </Suspense>
          {/* Arrived from the dashboard's "Past due" tile — say so, and make it
              removable, so the list never looks mysteriously short. */}
          {overdueOnly && (
            <Link
              href={hrefFor({ due: "" })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--qa-rose-soft)] px-2.5 py-1 text-xs font-medium text-[var(--qa-rose-strong)] transition-opacity hover:opacity-80"
            >
              Past due
              <X className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Suspense fallback={<div className="h-10 w-40" />}>
            {/* Empty-string option needs an explicit placeholder, or the
                trigger renders blank when no status is selected. */}
            <ListSortSelect options={statusOptions} paramName="status" placeholder="Any status" />
          </Suspense>
          <Suspense fallback={<div className="h-10 w-40" />}>
            <ListSortSelect options={SORT_OPTIONS} />
          </Suspense>
        </div>
      </div>

      {complaints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)]">
            <ClipboardList className="h-4 w-4" />
          </span>
          {hasNone ? (
            <>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">No complaints yet</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Anything you file shows up here with its status and deadline.
              </p>
              <Link
                href="/student/complaints/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Submit a complaint
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                Nothing matches these filters
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                You have {counts.all} {counts.all === 1 ? "complaint" : "complaints"} in total.
              </p>
              <Link
                href="/student/complaints"
                className="mt-4 inline-flex items-center rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                Clear filters
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <ComplaintRowHeader />

          <ul className="divide-y divide-[var(--border)]">
            {complaints.map((c) => (
              <ComplaintListRow
                key={String(c._id)}
                complaint={c as unknown as ComplaintRowData}
                hrefPrefix="/student/complaints"
              />
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="qa-tabular text-xs text-[var(--muted-foreground)]">
            {firstRow}&ndash;{lastRow} of {matchCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={hrefFor({ page: String(page - 1) })}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] opacity-50">
                Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={hrefFor({ page: String(page + 1) })}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] opacity-50">
                Next
              </span>
            )}
          </div>
        </div>
      )}

      {isFiltered && complaints.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link
            href="/student/complaints"
            className="underline underline-offset-2 hover:text-[var(--foreground)]"
          >
            Clear filters
          </Link>
        </p>
      )}
    </div>
  );
}
