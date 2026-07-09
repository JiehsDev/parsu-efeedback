// src/app/qa/dashboard/page.tsx
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";

export default async function QaDashboardPage() {
  await connectToDatabase();

  const [statusCounts, overdueCount, avgRatingResult, priorityCounts] = await Promise.all([
    Complaint.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Complaint.countDocuments({ isOverdue: true, status: { $nin: ["resolved", "closed"] } }),
    Complaint.aggregate([
      { $match: { studentRating: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: "$studentRating" }, count: { $sum: 1 } } },
    ]),
    Complaint.aggregate([
      { $match: { isArchived: false, status: { $nin: ["resolved", "closed"] } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
  const total = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;
  const resolved = (countMap.resolved ?? 0) + (countMap.closed ?? 0);
  const complianceRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const avgRating = avgRatingResult[0]?.avg ?? null;
  const ratingCount = avgRatingResult[0]?.count ?? 0;

  const priorityMap = Object.fromEntries(priorityCounts.map((p: any) => [p._id, p.count]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">QA Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Institution-wide monitoring — read-only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Complaints" value={total} />
        <StatCard label="Overdue" value={overdueCount} tone="danger" />
        <StatCard label="Resolution Rate" value={`${complianceRate}%`} tone="success" />
        <StatCard
          label="Avg. Rating"
          value={avgRating ? `${avgRating.toFixed(1)} / 5` : "—"}
          hint={ratingCount > 0 ? `${ratingCount} ratings` : undefined}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Open Complaints by Priority
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["low", "medium", "high", "critical"].map((p) => (
            <StatCard
              key={p}
              label={p}
              value={priorityMap[p] ?? 0}
              tone={p === "critical" ? "danger" : "default"}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Status Breakdown</h2>
        <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {Object.entries(countMap).map(([status, count]) => (
                <tr key={status} className="bg-[var(--card)]">
                  <td className="px-4 py-3 text-[var(--foreground)] capitalize">
                    {status.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{count as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "success";
  hint?: string;
}) {
  const toneClass = {
    default: "text-[var(--foreground)]",
    danger: "text-[var(--destructive)]",
    success: "text-emerald-400",
  }[tone];

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm text-[var(--muted-foreground)] capitalize">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}
