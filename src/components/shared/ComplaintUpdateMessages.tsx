import { TimelineEvent } from "./TimelineEvent";

type UpdateEvent = {
  _id: unknown;
  eventType: string;
  message?: string | null;
};

export function ComplaintUpdateMessages({
  events,
  viewerRole = "handler",
}: {
  events: UpdateEvent[];
  viewerRole?: string;
}) {
  const updates = events.filter(
    (event) =>
      ["status_changed", "resolved", "reopened"].includes(event.eventType) && event.message?.trim(),
  );
  if (!updates.length) return null;

  return (
    <section
      aria-labelledby="complaint-update-messages-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <h2
        id="complaint-update-messages-heading"
        className="text-sm font-semibold text-[var(--foreground)]"
      >
        Update messages
      </h2>
      <div className="mt-4">
        {[...updates].reverse().map((event) => (
          <TimelineEvent key={String(event._id)} event={event} viewerRole={viewerRole} />
        ))}
      </div>
    </section>
  );
}
