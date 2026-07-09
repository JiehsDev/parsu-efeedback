// src/app/staff/complaints/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

export default async function StaffComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  await connectToDatabase();
  const { status } = await searchParams;

  const filter: Record<string, unknown> = {
    assignedOfficeRef: session!.user.officeRef,
    isArchived: false,
  };
  if (status) filter.status = status;

  const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean();

  const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: "", label: "All" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "pending_information", label: "Pending Info" },
    { value: "escalated", label: "Escalated" },
    { value: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Complaint Queue</h1>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/staff/complaints?status=${f.value}` : "/staff/complaints"}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${
              (status ?? "") === f.value
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {complaints.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">No complaints match this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">Ticket</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Assigned To</th>
                <th className="px-4 py-2 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {complaints.map((c: any) => (
                <tr
                  key={c._id}
                  className="bg-[var(--card)] transition-colors hover:bg-[var(--muted)]/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/staff/complaints/${c._id}`}
                      className="font-mono text-xs text-[var(--primary)] hover:underline"
                    >
                      {c.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <Link href={`/staff/complaints/${c._id}`} className="hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status as ComplaintStatus} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)] capitalize">
                    {c.priority}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {c.assignedStaffRef ? "Assigned" : "— Unassigned —"}
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
      )}
    </div>
  );
}
