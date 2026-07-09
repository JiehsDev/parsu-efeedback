// src/app/admin/dashboard/page.tsx
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Complaint } from "@/models/Complaint";

export default async function AdminDashboardPage() {
  await connectToDatabase();

  const [userCount, openComplaints, overdueComplaints] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Complaint.countDocuments({ status: { $nin: ["resolved", "closed"] }, isArchived: false }),
    Complaint.countDocuments({ isOverdue: true, status: { $nin: ["resolved", "closed"] } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Admin Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Users" value={userCount} />
        <StatCard label="Open Complaints" value={openComplaints} />
        <StatCard label="Overdue" value={overdueComplaints} tone="danger" />
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
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
