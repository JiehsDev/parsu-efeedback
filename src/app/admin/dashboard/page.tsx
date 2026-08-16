// src/app/admin/dashboard/page.tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileBarChart,
  Inbox,
  ScrollText,
  Tag,
  Users,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Complaint } from "@/models/Complaint";
import { getMonthlyTrends } from "@/features/analytics/services/analytics.service";
import { TrendChart } from "@/components/analytics/TrendChart";

const QUICK_LINKS = [
  { href: "/admin/users", label: "Users", description: "Manage accounts & roles", icon: Users },
  { href: "/admin/offices", label: "Offices", description: "Colleges & service offices", icon: Building2 },
  { href: "/admin/categories", label: "Categories", description: "Complaint categories", icon: Tag },
  { href: "/admin/audit-logs", label: "Audit Logs", description: "Every system action", icon: ScrollText },
];

export default async function AdminDashboardPage() {
  await connectToDatabase();

  const [userCount, openComplaints, overdueComplaints, trends] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Complaint.countDocuments({ status: { $nin: ["resolved", "closed"] }, isArchived: false }),
    Complaint.countDocuments({ isOverdue: true, status: { $nin: ["resolved", "closed"] } }),
    getMonthlyTrends({ isArchived: false }),
  ]);

  const STATS = [
    {
      label: "Active Users",
      value: userCount,
      icon: Users,
      tint: "bg-[var(--secondary)]/15 text-[var(--secondary)]",
      chipBorder: "border-[var(--secondary)]/30",
      chipBg: "bg-[var(--secondary)]/10",
      chipText: "text-[var(--secondary)]",
    },
    {
      label: "Open Complaints",
      value: openComplaints,
      icon: Inbox,
      tint: "bg-[var(--primary)]/15 text-[var(--primary)]",
      chipBorder: "border-[var(--primary)]/30",
      chipBg: "bg-[var(--primary)]/10",
      chipText: "text-[var(--primary)]",
    },
    {
      label: "Overdue",
      value: overdueComplaints,
      icon: AlertTriangle,
      tint: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
      chipBorder: "border-[var(--destructive)]/30",
      chipBg: "bg-[var(--destructive)]/10",
      chipText: "text-[var(--destructive)]",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Admin Dashboard
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          System-wide overview and configuration.
        </p>
      </div>

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
          </div>
        ))}
      </div>

      <div
        role="region"
        aria-labelledby="admin-trend-heading"
        className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="admin-trend-heading" className="text-sm font-semibold text-[var(--foreground)]">
            Complaint Trend
          </h2>
          <Link
            href="/admin/reports"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            Reports
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {trends.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">Not enough data yet.</p>
        ) : (
          <div className="mt-4">
            <TrendChart data={trends} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2.5">
          <FileBarChart className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Manage
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--muted)]/30"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
                <link.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--foreground)]">
                  {link.label}
                </span>
                <span className="block truncate text-xs text-[var(--muted-foreground)]">
                  {link.description}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
