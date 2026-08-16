// src/app/qa/sla-compliance/page.tsx
import { AlertTriangle, Building2, CheckCircle2, Timer } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";

export default async function QaSlaCompliancePage() {
  await connectToDatabase();

  const officeBreakdown = await Complaint.aggregate([
    {
      $lookup: {
        from: "offices",
        localField: "assignedOfficeRef",
        foreignField: "_id",
        as: "office",
      },
    },
    { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
    { $match: { isArchived: false, status: { $in: ["resolved", "closed"] } } },
    {
      $addFields: {
        isCompliant: {
          $and: [
            { $ne: ["$resolvedAt", null] },
            { $ne: ["$slaResolutionDueAt", null] },
            { $lte: ["$resolvedAt", "$slaResolutionDueAt"] },
          ],
        },
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$office.name", "Unassigned"] },
        total: { $sum: 1 },
        compliant: { $sum: { $cond: ["$isCompliant", 1, 0] } },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const currentlyOverdue = await Complaint.find({
    isOverdue: true,
    status: { $nin: ["resolved", "closed"] },
    isArchived: false,
  })
    .populate("assignedOfficeRef", "name")
    .sort({ slaResolutionDueAt: 1 })
    .limit(50)
    .lean();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          SLA Compliance
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Institution-wide compliance rate by office, and currently overdue complaints.
        </p>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          <Building2 className="h-3 w-3" />
          Compliance by office
        </p>
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {officeBreakdown.map((row: any) => {
              const percent = row.total > 0 ? Math.round((row.compliant / row.total) * 100) : 0;
              const tone =
                percent >= 80
                  ? "text-emerald-400"
                  : percent >= 50
                    ? "text-amber-400"
                    : "text-[var(--destructive)]";
              const barTone =
                percent >= 80 ? "bg-emerald-400" : percent >= 50 ? "bg-amber-400" : "bg-[var(--destructive)]";
              return (
                <li key={row._id} className="flex items-center gap-4 px-5 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                      {row._id}
                    </span>
                    <span className="mt-1 block h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-[var(--muted)]">
                      <span
                        className={`block h-full rounded-full ${barTone}`}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {row.compliant}/{row.total} within SLA
                  </span>
                  <span className={`w-12 shrink-0 text-right text-sm font-bold ${tone}`}>
                    {percent}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--destructive)]">
          <AlertTriangle className="h-3 w-3" />
          Currently overdue
        </p>
        {currentlyOverdue.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              Nothing overdue right now.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
            <ul className="divide-y divide-[var(--border)]">
              {currentlyOverdue.map((c: any) => (
                <li key={c._id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--destructive)]/15 text-[var(--destructive)]">
                    <Timer className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs text-[var(--foreground)]">
                      {c.ticketNumber}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{c.assignedOfficeRef?.name ?? "—"}</span>
                      <span>·</span>
                      <span className="capitalize">{c.priority}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--destructive)]">
                    Due {new Date(c.slaResolutionDueAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
