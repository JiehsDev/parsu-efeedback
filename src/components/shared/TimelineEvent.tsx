// src/components/shared/TimelineEvent.tsx
import { RelativeTime } from "@/components/shared/RelativeTime";
import { formatEnumLabel, roleLabel, statusLabel } from "@/lib/display-labels";

const EVENT_LABELS: Record<string, string> = {
  submitted: "Complaint submitted",
  assigned: "Assigned to office",
  reassigned: "Reassigned",
  status_changed: "Status changed",
  note_added: "Internal note added",
  attachment_added: "Attachment added",
  escalated: "Escalated",
  resolved: "Marked resolved",
  reopened: "Reopened",
  closed: "Closed",
  rated: "Rated by student",
  edited: "Details updated by student",
  withdrawn: "Withdrawn by student",
  information_requested: "Additional information requested",
  information_submitted: "Additional information submitted",
};

export function TimelineEvent({ event }: { event: any }) {
  const actor = event.actorRef;
  const actorName = actor
    ? `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim()
    : "System";
  const eventLabel =
    event.eventType === "assigned" && event.toValue === "in_progress"
      ? "Complaint picked up"
      : event.eventType === "closed" && !event.actorRef
        ? "Complaint closed automatically"
        : EVENT_LABELS[event.eventType] ?? formatEnumLabel(event.eventType);
  const isStatusValue = ["submitted", "assigned", "in_progress", "pending_information", "escalated", "resolved", "closed", "withdrawn"].includes(event.fromValue) ||
    ["submitted", "assigned", "in_progress", "pending_information", "escalated", "resolved", "closed", "withdrawn"].includes(event.toValue);
  return (
    <div className="relative pb-6 pl-6 last:pb-0">
      <div className="absolute top-1 left-0 h-2 w-2 rounded-full bg-[var(--primary)]" />
      <div className="absolute top-3 left-[3px] h-full w-px bg-[var(--border)]" />
      <p className="text-sm font-medium text-[var(--foreground)]">
        {event.eventType === "status_changed" && event.fromValue === "closed" && event.toValue === "in_progress"
          ? "Complaint reopened"
          : eventLabel}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
        {actorName}{actor?.role ? ` · ${roleLabel(actor.role)}` : ""}
      </p>
      {event.message && (
        <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{event.message}</p>
      )}
      {isStatusValue && (event.fromValue || event.toValue) && (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {event.fromValue ? statusLabel(event.fromValue) : "-"} → {event.toValue ? statusLabel(event.toValue) : "-"}
        </p>
      )}
      <RelativeTime
        date={event.createdAt}
        className="mt-0.5 block text-xs text-[var(--muted-foreground)]"
      />
    </div>
  );
}
