import { History, Shuffle } from "lucide-react";
import { statusLabel } from "@/lib/display-labels";

export interface AssignmentHistoryEntry {
  _id: string;
  kind: "assignment" | "escalation";
  createdAt: string;
  sourceOfficeName?: string | null;
  destinationOfficeName?: string | null;
  assignedStaffName?: string | null;
  assignedByName?: string | null;
  message?: string | null;
  reason?: string | null;
  resultingStatus?: string | null;
}

export function AssignmentHistoryPanel({
  entries,
  simplified = false,
}: {
  entries: AssignmentHistoryEntry[];
  simplified?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-[var(--muted-foreground)]" />
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Assignment &amp; Escalation History
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          No assignment changes have been recorded yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry._id}`} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  entry.kind === "escalation"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-[var(--primary)]/15 text-[var(--primary)]"
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {entry.kind === "escalation"
                      ? "Escalated"
                      : entry.reason
                        ? "Reassigned"
                        : "Assigned"}
                  </p>
                  <time className="text-xs text-[var(--muted-foreground)]">
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-sm text-[var(--foreground)]/90">
                  {entry.sourceOfficeName
                    ? `Reassigned from ${entry.sourceOfficeName} to `
                    : "Assigned to "}
                  {entry.destinationOfficeName ?? "unassigned office"}
                </p>
                {!simplified && (
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--muted-foreground)]">
                    <p>Staff: {entry.assignedStaffName ?? "Office level"}</p>
                    <p>Changed by: {entry.assignedByName ?? "System"}</p>
                    {entry.resultingStatus && <p>Status: {statusLabel(entry.resultingStatus)}</p>}
                  </div>
                )}
                {(entry.message || entry.reason) && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {entry.reason ? `Reason: ${entry.reason}` : entry.message}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
