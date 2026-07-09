// src/app/student/dashboard/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

export default async function StudentDashboardPage() {
  const session = await auth();
  await connectToDatabase();

  const studentId = session!.user.id;

  const [complaints, statusCounts] = await Promise.all([
    Complaint.find({ studentRef: studentId, isArchived: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Complaint.aggregate([
      { $match: { studentRef: session!.user.id, isArchived: false } },
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Track and manage your submitted complaints.
          </p>
        </div>
        <Link
          href="/student/complaints/new"
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          Submit Complaint
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={openCount} />
        <StatCard label="Resolved" value={resolvedCount} />
        <StatCard
          label="Total"
          value={
            complaints.length > 0 ? Object.values(countMap).reduce((a: any, b: any) => a + b, 0) : 0
          }
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Complaints</h2>
          <Link
            href="/student/complaints"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            View all
          </Link>
        </div>

        {complaints.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
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
          <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Ticket</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {complaints.map((c: any) => (
                  <tr key={c._id} className="bg-[var(--card)]">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                      {c.ticketNumber}
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{c.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status as ComplaintStatus} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
