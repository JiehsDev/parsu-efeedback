// src/app/student/dashboard/page.tsx
import Link from "next/link";
import { ArrowRight, Bell, ClipboardList, MessageSquareWarning, Plus, Timer, Zap } from "lucide-react";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import {
  ComplaintListRow,
  ComplaintRowHeader,
  OPEN_STATUSES,
  type ComplaintRowData,
} from "@/components/shared/ComplaintListRow";

// Shown only to students with nothing filed yet. This used to sit at the
// bottom of every dashboard forever, which made a logged-in workspace read
// like a marketing page — three line icons explaining the product to
// someone already using it. As a first-run explainer it earns its place;
// once you have complaints, your complaints are the explanation.
const HOW_IT_WORKS = [
  {
    icon: Zap,
    title: "Routed instantly",
    body: "Sent to the right office the moment you submit — no manual triage.",
  },
  {
    icon: Timer,
    title: "Tracked against a deadline",
    body: "Escalated automatically if the office is at risk of missing it.",
  },
  {
    icon: Bell,
    title: "You get notified",
    body: "When it is assigned, when it is updated, and when it is resolved.",
  },
];

export default async function StudentDashboardPage() {
  const session = await auth();
  await connectToDatabase();

  const studentId = session!.user.id;
  const firstName = session!.user.name?.split(" ")[0] ?? "there";

  const [complaints, statusCounts] = await Promise.all([
    Complaint.find({ studentRef: studentId, isArchived: false })
      .select(
        "title ticketNumber priority status createdAt updatedAt slaResponseDueAt slaResolutionDueAt isOverdue",
      )
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean(),
    Complaint.aggregate<{ _id: string; count: number; overdue: number }>([
      { $match: { studentRef: new Types.ObjectId(studentId), isArchived: false } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          // Rolled into the same aggregation rather than a second round trip
          overdue: { $sum: { $cond: ["$isOverdue", 1, 0] } },
        },
      },
    ]),
  ]);

  const countMap: Record<string, number> = Object.fromEntries(
    statusCounts.map((s) => [s._id, s.count]),
  );
  const openStatuses = OPEN_STATUSES as readonly string[];
  const openCount = openStatuses.reduce((sum, s) => sum + (countMap[s] ?? 0), 0);
  const awaitingYou = countMap.pending_information ?? 0;
  const overdueCount = statusCounts
    .filter((s) => openStatuses.includes(s._id))
    .reduce((sum, s) => sum + s.overdue, 0);
  const resolvedCount = (countMap.resolved ?? 0) + (countMap.closed ?? 0);
  const totalCount = Object.values(countMap).reduce((a, b) => a + b, 0);

  // Every tile is a link into the list with the matching filter already
  // applied — a number you can't act on is just decoration.
  const SUMMARY = [
    {
      label: "Open",
      value: openCount,
      href: "/student/complaints",
      emphasis: "",
    },
    {
      label: "Needs your reply",
      value: awaitingYou,
      href: "/student/complaints?status=pending_information",
      emphasis: awaitingYou > 0 ? "text-[var(--qa-amber-strong)]" : "",
    },
    {
      label: "Past due",
      value: overdueCount,
      href: "/student/complaints?due=overdue",
      emphasis: overdueCount > 0 ? "text-[var(--qa-rose-strong)]" : "",
    },
    {
      label: "Resolved",
      value: resolvedCount,
      href: "/student/complaints?view=resolved",
      emphasis: "",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          Welcome back, {firstName}
        </h1>
        <Link
          href="/student/complaints/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Submit Complaint
        </Link>
      </div>

      {/* The one thing on this page that is genuinely blocked on the student.
          "Pending information" means an office asked a question and is waiting
          — it deserves to interrupt, unlike an overdue count, which is the
          office's problem to fix and lives quietly in the summary strip. */}
      {awaitingYou > 0 && (
        <Link
          href="/student/complaints?status=pending_information"
          className="flex items-center gap-2.5 rounded-lg border border-[var(--qa-amber)]/30 bg-[var(--qa-amber-soft)] px-4 py-3 text-sm text-[var(--qa-amber-strong)] transition-opacity hover:opacity-90"
        >
          <MessageSquareWarning className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {awaitingYou === 1
              ? "One complaint is waiting on more information from you."
              : `${awaitingYou} complaints are waiting on more information from you.`}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {totalCount > 0 && (
        // gap-px over a border-coloured background draws the hairlines, which
        // survives the 2-col → 4-col reflow without divide-x/divide-y fighting.
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
          {SUMMARY.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--muted)]/50"
            >
              <p
                className={`qa-tabular text-2xl leading-none font-semibold tracking-tight ${
                  s.emphasis || (s.value === 0 ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]")
                }`}
              >
                {s.value}
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{s.label}</p>
            </Link>
          ))}
        </div>
      )}

      {complaints.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-10">
          <div className="text-center">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)]">
              <ClipboardList className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-medium text-[var(--foreground)]">No complaints yet</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Here is what happens after you submit one.
            </p>
            <Link
              href="/student/complaints/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Submit your first complaint
            </Link>
          </div>

          <div className="mt-8 grid gap-5 border-t border-[var(--border)] pt-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.title} className="flex items-start gap-2.5">
                <step.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recent activity</h2>
            <Link
              href="/student/complaints"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              View all {totalCount}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

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
    </div>
  );
}
