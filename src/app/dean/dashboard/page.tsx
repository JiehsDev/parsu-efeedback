// src/app/dean/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { Types } from "mongoose";

export default async function DeanDashboardPage() {
  const session = await auth();
  await connectToDatabase();

  if (!session!.user.collegeRef) {
    console.log("Signed-in user has no college assigned", session?.user.collegeRef);
  }
  const collegeRef = new Types.ObjectId(session!.user.collegeRef);

  const statusCounts = await Complaint.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "studentRef",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $match: { "student.collegeRef": collegeRef, isArchived: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]));
  const total = Object.values(countMap).reduce((a: any, b: any) => a + b, 0) as number;
  const open =
    (countMap.submitted ?? 0) +
    (countMap.assigned ?? 0) +
    (countMap.in_progress ?? 0) +
    (countMap.pending_information ?? 0) +
    (countMap.escalated ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Overview of complaints across your college.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={total} />
        <StatCard label="Open" value={open} />
        <StatCard label="Escalated" value={countMap.escalated ?? 0} tone="danger" />
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
  tone?: "default" | "danger" | "success";
}) {
  const toneClass = {
    default: "text-[var(--foreground)]",
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
