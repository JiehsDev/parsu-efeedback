// src/app/staff/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";

export default async function StaffDashboardPage() {
  const session = await auth();
  await connectToDatabase();

  const officeRef = session!.user.officeRef;

  const statusCounts = await Complaint.aggregate([
    { $match: { assignedOfficeRef: officeRef, isArchived: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));

  const overdueCount = await Complaint.countDocuments({
    assignedOfficeRef: officeRef,
    isOverdue: true,
    status: { $nin: ["resolved", "closed"] },
  });

  const unassignedCount = await Complaint.countDocuments({
    assignedOfficeRef: officeRef,
    assignedStaffRef: null,
    status: { $nin: ["resolved", "closed"] },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Overview of complaints assigned to your office.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Unassigned" value={unassignedCount} tone="warn" />
        <StatCard label="In Progress" value={countMap.in_progress ?? 0} />
        <StatCard label="Overdue" value={overdueCount} tone="danger" />
        <StatCard label="Resolved" value={countMap.resolved ?? 0} tone="success" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn" | "danger" | "success";
}) {
  const toneClass = {
    default: "text-[var(--foreground)]",
    warn: "text-amber-400",
    danger: "text-[var(--destructive)]",
    success: "text-emerald-400",
  }[tone];

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
