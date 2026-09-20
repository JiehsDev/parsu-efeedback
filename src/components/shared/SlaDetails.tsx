import { Timer } from "lucide-react";
import { formatEnumLabel } from "@/lib/display-labels";

type SlaDetailsProps = {
  complaint: {
    status: string;
    submittedAt?: Date | string | null;
    resolvedAt?: Date | string | null;
    slaResponseDueAt?: Date | string | null;
    slaResolutionDueAt?: Date | string | null;
    lastWarningNotifiedAt?: Date | string | null;
    lastResponseWarningNotifiedAt?: Date | string | null;
    isOverdue?: boolean;
  };
  firstResponseAt?: Date | string | null;
  events?: Array<{ eventType?: string; message?: string | null; createdAt?: Date | string }>;
  simplified?: boolean;
};

function dateLabel(value?: Date | string | null) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function durationLabel(start?: Date | string | null, end?: Date | string | null) {
  if (!start || !end) return "Not available";
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

export function SlaDetails({ complaint, firstResponseAt, events = [], simplified = false }: SlaDetailsProps) {
  const now = Date.now();
  const active = !["resolved", "closed", "withdrawn"].includes(complaint.status);
  const resolutionDue = complaint.slaResolutionDueAt ? new Date(complaint.slaResolutionDueAt) : null;
  const overdue = Boolean(complaint.isOverdue) || Boolean(active && resolutionDue && resolutionDue.getTime() < now);
  const warningReached = Boolean(complaint.lastWarningNotifiedAt || complaint.lastResponseWarningNotifiedAt);
  const resolved = Boolean(complaint.resolvedAt);
  const resolutionMet = resolved && resolutionDue ? new Date(complaint.resolvedAt as string).getTime() <= resolutionDue.getTime() : null;
  const state = overdue ? "Overdue" : warningReached ? "Warning" : resolved ? (resolutionMet ? "Met" : "Breached") : "On Track";
  const escalationEvent = events.find((event) => event.eventType === "escalated" && event.message);

  const rows = simplified
    ? [["Current SLA state", state], ["Resolution due", dateLabel(complaint.slaResolutionDueAt)]]
    : [
        ["Current SLA state", state],
        ["Response due", dateLabel(complaint.slaResponseDueAt)],
        ["Resolution due", dateLabel(complaint.slaResolutionDueAt)],
        ["Warning threshold reached", warningReached ? "Yes" : "No"],
        ["Overdue", overdue ? "Yes" : "No"],
        ["First response time", durationLabel(complaint.submittedAt, firstResponseAt)],
        ["Resolution time", durationLabel(complaint.submittedAt, complaint.resolvedAt)],
        ["SLA compliance", resolved ? (resolutionMet ? "Met" : "Breached") : "Pending result"],
      ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5" aria-labelledby="sla-details-heading">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-[var(--muted-foreground)]" />
        <h2 id="sla-details-heading" className="text-sm font-semibold text-[var(--foreground)]">SLA details</h2>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</dd>
          </div>
        ))}
      </div>
      {escalationEvent && !simplified && (
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
          Escalation trigger: {escalationEvent.message || formatEnumLabel(escalationEvent.eventType)}
        </p>
      )}
    </section>
  );
}
