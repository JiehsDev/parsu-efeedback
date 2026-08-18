// src/app/dean/complaints/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Inbox } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Types } from "mongoose";
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
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
];

export default async function DeanComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string }>;
}) {
  const session = await auth();
  await connectToDatabase();
  const { status, q, sort } = await searchParams;
  const search = q?.trim();
  const sortOrder = sort === "oldest" ? 1 : -1;

  if (!session!.user.collegeRef) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
          No college is assigned to this account.
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Contact an administrator.</p>
      </div>
    );
  }
  const collegeRef = new Types.ObjectId(session!.user.collegeRef);
  const pipeline: any[] = [
    {
      $lookup: {
        from: "users",
        localField: "studentRef",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    {
      $lookup: {
        from: "offices",
        localField: "student.collegeRef",
        foreignField: "_id",
        as: "college",
      },
    },
    { $unwind: { path: "$college", preserveNullAndEmptyArrays: true } },
    {
      $match: {
        "student.collegeRef": collegeRef,
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
      },
    },
    { $sort: { createdAt: sortOrder } },
  ];

  const complaints = await Complaint.aggregate(pipeline);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          College Complaints
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Every complaint filed by a student in your college.
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
          if (search) params.set("q", search);
          if (sort) params.set("sort", sort);
          const href = params.toString() ? `/dean/complaints?${params}` : "/dean/complaints";

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
              <li key={c._id}>
                <Link
                  href={`/dean/complaints/${c._id}`}
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
                      <span>
                        {c.student.firstName} {c.student.lastName}
                        {c.student.employeeOrStudentId ? ` · ${c.student.employeeOrStudentId}` : ""}
                        {c.college?.name ? ` · ${c.college.name}` : ""}
                      </span>
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
