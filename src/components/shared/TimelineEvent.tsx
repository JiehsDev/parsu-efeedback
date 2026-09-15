// src/components/shared/TimelineEvent.tsx
import { RelativeTime } from "@/components/shared/RelativeTime";

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
  return (
    <div className="relative pb-6 pl-6 last:pb-0">
      <div className="absolute top-1 left-0 h-2 w-2 rounded-full bg-[var(--primary)]" />
      <div className="absolute top-3 left-[3px] h-full w-px bg-[var(--border)]" />
      <p className="text-sm font-medium text-[var(--foreground)]">
        {EVENT_LABELS[event.eventType] ?? event.eventType}
      </p>
      {event.message && (
        <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{event.message}</p>
      )}
      <RelativeTime
        date={event.createdAt}
        className="mt-0.5 block text-xs text-[var(--muted-foreground)]"
      />
    </div>
  );
}
