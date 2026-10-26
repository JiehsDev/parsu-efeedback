// src/components/shared/TimelineEvent.tsx
import { RelativeTime } from "@/components/shared/RelativeTime";
import { formatEnumLabel, roleLabel, statusLabel } from "@/lib/display-labels";
import { getActorDisplayName } from "@/lib/actor-display";

const EVENT_LABELS: Record<string, string> = {
  submitted: "Complaint submitted",
  assigned: "Handler assigned",
  reassigned: "Reassigned",
  assignment_released: "Assignment released",
  status_changed: "Status changed",
  note_added: "Internal note added",
  attachment_added: "Attachment added",
  escalated: "OSAS Head review requested",
  forwarding_requested: "Forwarding requested",
  forwarding_approved: "Forwarding approved",
  forwarding_rejected: "Forwarding rejected",
  complaint_forwarded: "Complaint forwarded",
  resolved: "Marked resolved",
  reopened: "Reopened",
  closed: "Closed",
  rated: "Rated by student",
  edited: "Details updated by student",
  withdrawn: "Withdrawn by student",
  information_requested: "Additional information requested",
  information_submitted: "Additional information submitted",
};

export function TimelineEvent({
  event,
  viewerRole = "handler",
}: {
  event: any;
  viewerRole?: string;
}) {
  const studentReviewEvent =
    viewerRole === "student" &&
    [
      "assigned",
      "reassigned",
      "assignment_released",
      "escalated",
      "forwarding_requested",
      "forwarding_approved",
      "forwarding_rejected",
      "complaint_forwarded",
    ].includes(event.eventType);
  const actor = event.actorRef;
  const actorName = getActorDisplayName(actor, viewerRole);
  const eventLabel =
    event.eventType === "assigned" && event.toValue === "in_progress"
      ? "Handler assigned"
      : event.eventType === "closed" && !event.actorRef
        ? "Complaint closed automatically"
        : (EVENT_LABELS[event.eventType] ?? formatEnumLabel(event.eventType));
  const isStatusValue =
    [
      "submitted",
      "assigned",
      "in_progress",
      "pending_information",
      "escalated",
      "resolved",
      "closed",
      "withdrawn",
    ].includes(event.fromValue) ||
    [
      "submitted",
      "assigned",
      "in_progress",
      "pending_information",
      "escalated",
      "resolved",
      "closed",
      "withdrawn",
    ].includes(event.toValue);
  return (
    <div className="relative pb-6 pl-6 last:pb-0">
      <div className="absolute top-1 left-0 h-2 w-2 rounded-full bg-[var(--primary)]" />
      <div className="absolute top-3 left-[3px] h-full w-px bg-[var(--border)]" />
      <p className="text-sm font-medium text-[var(--foreground)]">
        {event.eventType === "status_changed" &&
        event.fromValue === "closed" &&
        event.toValue === "in_progress"
          ? "Complaint reopened"
          : studentReviewEvent
            ? "Review updated"
            : eventLabel}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
        {studentReviewEvent ? "Complaint review" : actorName}
        {actor?.role && viewerRole !== "student" ? ` · ${roleLabel(actor.role)}` : ""}
      </p>
      {event.resolutionSummary && (
        <p className="mt-1 text-sm break-words whitespace-pre-wrap text-[var(--foreground)]">
          <span className="font-medium">Resolution details: </span>
          {event.resolutionSummary}
        </p>
      )}
      {event.message && !studentReviewEvent && (
        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-[var(--muted-foreground)]">
          {event.message}
        </p>
      )}
      {isStatusValue && !studentReviewEvent && (event.fromValue || event.toValue) && (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {event.fromValue ? statusLabel(event.fromValue) : "-"} →{" "}
          {event.toValue ? statusLabel(event.toValue) : "-"}
        </p>
      )}
      <RelativeTime
        date={event.createdAt}
        className="mt-0.5 block text-xs text-[var(--muted-foreground)]"
      />
    </div>
  );
}
