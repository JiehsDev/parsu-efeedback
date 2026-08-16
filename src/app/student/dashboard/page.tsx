// src/app/student/dashboard/page.tsx
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Inbox,
  MessageSquarePlus,
  Plus,
  Timer,
  UserRound,
  Zap,
} from "lucide-react";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

const QUICK_ACTIONS = [
  {
    href: "/student/complaints/new",
    label: "Submit a complaint",
    description: "Report a new issue or concern",
    icon: ClipboardList,
  },
  {
    href: "/student/feedback/new",
    label: "Give feedback",
    description: "Share a suggestion or compliment",
    icon: MessageSquarePlus,
  },
  {
    href: "/student/complaints",
    label: "View all complaints",
    description: "See your full history and status",
    icon: Inbox,
  },
  {
    href: "/student/profile",
    label: "Update profile",
    description: "Keep your account details current",
    icon: UserRound,
  },
];

export default async function StudentDashboardPage() {
  const session = await auth();
  await connectToDatabase();

  const studentId = session!.user.id;
  const firstName = session!.user.name?.split(" ")[0] ?? "there";

  const [complaints, statusCounts] = await Promise.all([
    Complaint.find({ studentRef: studentId, isArchived: false })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Complaint.aggregate([
      { $match: { studentRef: new Types.ObjectId(studentId), isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const countMap: Record<string, number> = Object.fromEntries(
    statusCounts.map((s: any) => [s._id, s.count]),
  );
  const openCount =
    (countMap.submitted ?? 0) +
    (countMap.assigned ?? 0) +
    (countMap.in_progress ?? 0) +
    (countMap.pending_information ?? 0) +
    (countMap.escalated ?? 0);
  const resolvedCount = (countMap.resolved ?? 0) + (countMap.closed ?? 0);
  const totalCount = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;

  const STATS = [
    {
      label: "Open",
      value: openCount,
      helper: "Awaiting resolution",
      icon: Inbox,
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
    {
      label: "Resolved",
      value: resolvedCount,
      helper: "Closed or resolved",
      icon: CheckCircle2,
      tint: "bg-emerald-500/15 text-emerald-400",
      chipBorder: "border-emerald-500/30",
      chipBg: "bg-emerald-500/10",
      chipText: "text-emerald-400",
    },
    {
      label: "Total",
      value: totalCount,
      helper: "All-time submissions",
      icon: FileText,
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            Track and manage your submitted complaints.
          </p>
        </div>
        <Link
          href="/student/complaints/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Submit Complaint
        </Link>
      </div>

      {/* Mobile: one compact strip, no icons — cuts the height way down versus
          three full icon+helper cards, which is all vertical cost with
          little payoff at this width. */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-2 py-2.5 text-center ${stat.chipBorder} ${stat.chipBg}`}
          >
            <p className={`text-lg font-bold leading-none tracking-tight ${stat.chipText}`}>
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] leading-none text-[var(--muted-foreground)]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tint}`}
            >
              <stat.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--foreground)]">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{stat.label}</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{stat.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Complaints</h2>
            <Link
              href="/student/complaints"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {complaints.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <ClipboardList className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                No complaints yet. When something needs attention, submit it here.
              </p>
              <Link
                href="/student/complaints/new"
                className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Submit your first complaint
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {complaints.map((c: any) => (
                <li key={c._id}>
                  <Link
                    href={`/student/complaints/${c._id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--muted)]/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                        {c.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span className="font-mono">{c.ticketNumber}</span>
                        <span>·</span>
                        <span className="capitalize">{c.priority}</span>
                        <span>·</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </span>
                    </span>
                    <StatusBadge status={c.status as ComplaintStatus} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Quick Actions</h2>
          <div className="mt-4 space-y-1.5">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-[var(--muted)]/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <action.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    {action.label}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                    {action.description}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">What to expect</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          How your complaint moves once it's submitted.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--muted)]/30 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
              <Zap className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Routed instantly</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Your complaint is sent to the right office the moment you submit it — no manual
                triage.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--muted)]/30 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Timer className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Tracked against SLA</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Every case has a response and resolution deadline — escalated automatically if
                it's at risk.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--muted)]/30 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Bell className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Notified at every step</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                You'll hear from us the moment it's assigned, updated, or resolved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
