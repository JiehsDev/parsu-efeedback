// src/app/student/complaints/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

export default async function StudentComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  await connectToDatabase();

  const { submitted } = await searchParams;

  const complaints = await Complaint.find({
    studentRef: session!.user.id,
    isArchived: false,
  })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6">
      {submitted && (
        <div className="rounded-[var(--radius)] border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Complaint <span className="font-mono">{submitted}</span> submitted successfully.
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">My Complaints</h1>
        <Link
          href="/student/complaints/new"
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          Submit Complaint
        </Link>
      </div>

      {complaints.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            You haven't submitted any complaints yet.
          </p>
          <Link
            href="/student/complaints/new"
            className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Submit your first complaint
          </Link>
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
                <th className="px-4 py-2 font-medium">Submitted</th>
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
                      href={`/student/complaints/${c._id}`}
                      className="font-mono text-xs text-[var(--primary)] hover:underline"
                    >
                      {c.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <Link href={`/student/complaints/${c._id}`} className="hover:underline">
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
                    {new Date(c.createdAt).toLocaleDateString()}
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
