// src/components/shared/ComplaintListRow.tsx
//
// One complaint, rendered as a row. Shared between the student dashboard's
// "Recent" panel and the full complaints list so the two cannot drift into
// looking like two different products — the columns, the SLA wording and
// the priority rules are defined once, here.
import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { RelativeTime } from "./RelativeTime";
import { StatusBadge } from "./StatusBadge";
import type { ComplaintStatus } from "@/lib/constants";

export const OPEN_STATUSES = [
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
] as const satisfies readonly ComplaintStatus[];

export const DONE_STATUSES = [
  "resolved",
  "closed",
  "withdrawn",
] as const satisfies readonly ComplaintStatus[];

// Priority is shown by exception only. Every complaint has one, but "low"
// and "medium" are the overwhelming majority and flagging them would just
// add a badge to every row — so only the two worth reacting to render.
const PRIORITY_FLAG: Partial<Record<string, { label: string; className: string }>> = {
  high: {
    label: "High",
    className: "bg-[var(--qa-amber-soft)] text-[var(--qa-amber-strong)]",
  },
  critical: {
    label: "Critical",
    className: "bg-[var(--qa-rose-soft)] text-[var(--qa-rose-strong)]",
  },
};

export type ComplaintRowData = {
  _id: unknown;
  title: string;
  ticketNumber: string;
  priority: string;
  status: string;
  updatedAt: Date;
  slaResponseDueAt?: Date | null;
  slaResolutionDueAt?: Date | null;
  isOverdue?: boolean;
};

/**
 * Which SLA clock a student actually cares about right now.
 *
 * BR-030/BR-031 run two independent clocks. Before anyone picks the
 * complaint up ("submitted") the question is "when will someone reply?",
 * so the response deadline is the honest answer; once it is in someone's
 * hands the question becomes "when will this be fixed?" and the resolution
 * deadline takes over. Resolved/closed rows have no live clock at all.
 */
export function slaClock(complaint: {
  status: string;
  slaResponseDueAt?: Date | null;
  slaResolutionDueAt?: Date | null;
  isOverdue?: boolean;
}): { dueAt: Date; overdue: boolean } | null {
  if (!(OPEN_STATUSES as readonly string[]).includes(complaint.status)) return null;

  const dueAt =
    complaint.status === "submitted"
      ? (complaint.slaResponseDueAt ?? complaint.slaResolutionDueAt)
      : complaint.slaResolutionDueAt;
  if (!dueAt) return null;

  // isOverdue is the denormalised flag the hourly SLA cron maintains, so it
  // is only ever as fresh as the last cron run — comparing the date as well
  // means a row that tipped over in the last hour still reads as overdue.
  return {
    dueAt,
    overdue: Boolean(complaint.isOverdue) || new Date(dueAt).getTime() < Date.now(),
  };
}

/**
 * Column headers. These exist so the mono/tabular columns below read as
 * columns, rather than as a run-on line of middot-separated facts.
 */
export function ComplaintRowHeader({ showTicket = true }: { showTicket?: boolean }) {
  return (
    <div className="hidden items-center gap-4 border-b border-[var(--border)] bg-[var(--muted)]/40 px-4 py-2 text-[11px] font-medium tracking-wide text-[var(--muted-foreground)] uppercase sm:flex">
      {showTicket && <span className="w-[8.75rem] shrink-0">Ticket</span>}
      <span className="min-w-0 flex-1">Complaint</span>
      <span className="w-24 shrink-0 text-right">Due</span>
      <span className="w-[7.5rem] shrink-0">Status</span>
      <span className="w-16 shrink-0 text-right">Updated</span>
    </div>
  );
}

export function ComplaintListRow({
  complaint,
  hrefPrefix,
  showTicket = true,
}: {
  complaint: ComplaintRowData;
  /** e.g. "/student/complaints" — the row links to `${hrefPrefix}/${_id}`. */
  hrefPrefix: string;
  showTicket?: boolean;
}) {
  const flag = PRIORITY_FLAG[complaint.priority];
  const sla = slaClock(complaint);

  return (
    <li className="group/row relative">
      {/* Stretched link: the whole row is one target, but the copy button has
          to sit OUTSIDE the anchor — a <button> nested inside an <a> is
          invalid HTML and confuses screen readers. */}
      <Link
        href={`${hrefPrefix}/${String(complaint._id)}`}
        aria-label={`${complaint.ticketNumber}: ${complaint.title}`}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
      />
      <div className="pointer-events-none relative flex items-center gap-4 px-4 py-2.5 transition-colors group-hover/row:bg-[var(--muted)]/40">
        {showTicket && (
          <span className="qa-mono pointer-events-auto hidden w-[8.75rem] shrink-0 items-center gap-1 text-xs text-[var(--muted-foreground)] sm:inline-flex">
            <span className="truncate">{complaint.ticketNumber}</span>
            <CopyButton
              value={complaint.ticketNumber}
              className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
            />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-[var(--foreground)]">{complaint.title}</span>
            {flag && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${flag.className}`}
              >
                {flag.label}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] sm:hidden">
            <span className="qa-mono truncate">{complaint.ticketNumber}</span>
            <span aria-hidden>&middot;</span>
            <RelativeTime date={complaint.updatedAt} className="qa-tabular shrink-0" />
          </span>
        </span>

        <span className="hidden w-24 shrink-0 text-right text-xs sm:block">
          {sla ? (
            sla.overdue ? (
              <span className="font-medium text-[var(--qa-rose-strong)]">Overdue</span>
            ) : (
              <span className="qa-tabular text-[var(--muted-foreground)]">
                Due <RelativeTime date={sla.dueAt} />
              </span>
            )
          ) : (
            <span className="text-[var(--border)]" aria-hidden>
              &mdash;
            </span>
          )}
        </span>

        <span className="shrink-0 sm:w-[7.5rem]">
          <StatusBadge status={complaint.status as ComplaintStatus} />
        </span>

        <RelativeTime
          date={complaint.updatedAt}
          className="qa-tabular hidden w-16 shrink-0 text-right text-xs text-[var(--muted-foreground)] sm:block"
        />
      </div>
    </li>
  );
}
