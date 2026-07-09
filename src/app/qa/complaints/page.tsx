// src/app/qa/complaints/page.tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

export default async function QaComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  await connectToDatabase();
  const { status, priority } = await searchParams;

  const filter: Record<string, unknown> = { isArchived: false };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const complaints = await Complaint.find(filter)
    .populate("assignedOfficeRef", "name")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const STATUS_FILTERS = [
    { value: "", label: "All Statuses" },
    { value: "submitted", label: "Submitted" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "escalated", label: "Escalated" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">All Complaints</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.value) params.set("status", f.value);
          if (priority) params.set("priority", priority);
          const href = params.toString() ? `/qa/complaints?${params}` : "/qa/complaints";

          return (
            <Link
              key={f.value}
              href={href}
              className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${
                (status ?? "") === f.value
                  ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Ticket</th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Office</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {complaints.map((c: any) => (
              <tr key={c._id} className="bg-[var(--card)]">
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                  {c.ticketNumber}
                </td>
                <td className="px-4 py-3 text-[var(--foreground)]">{c.title}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">
                  {c.assignedOfficeRef?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status as ComplaintStatus} />
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] capitalize">
                  {c.priority}
                </td>
                <td className="px-4 py-3">
                  {c.isOverdue && (
                    <span className="text-xs font-medium text-[var(--destructive)]">Overdue</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
