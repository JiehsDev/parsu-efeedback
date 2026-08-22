// src/components/shared/StatusBadge.tsx
import type { ComplaintStatus } from "@/lib/constants";

// The app runs a fixed LIGHT theme (see globals.css). These styles used to
// reach for Tailwind's *-400 shades (emerald-400, amber-400) as badge text,
// which is a dark-theme habit — emerald-400 on a near-white fill measures
// ~1.8:1 and fails WCAG AA badly. Every pair below is a --qa-*-strong text
// colour on its matching --qa-*-soft fill, all >= 4.9:1.
const STATUS_STYLES: Record<
  ComplaintStatus,
  { label: string; className: string; dotClassName: string }
> = {
  submitted: {
    label: "Submitted",
    className: "bg-[var(--muted)] text-[var(--muted-foreground)]",
    dotClassName: "bg-[var(--qa-slate)]",
  },
  assigned: {
    label: "Assigned",
    className: "bg-[var(--qa-teal-soft)] text-[var(--qa-teal-strong)]",
    dotClassName: "bg-[var(--secondary)]",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-[var(--accent)] text-[var(--primary)]",
    dotClassName: "bg-[var(--primary)]",
  },
  pending_information: {
    label: "Pending Info",
    className: "bg-[var(--qa-amber-soft)] text-[var(--qa-amber-strong)]",
    dotClassName: "bg-[var(--qa-amber)]",
  },
  escalated: {
    label: "Escalated",
    className: "bg-[var(--qa-rose-soft)] text-[var(--qa-rose-strong)]",
    dotClassName: "bg-[var(--qa-rose)]",
  },
  resolved: {
    label: "Resolved",
    className: "bg-[var(--qa-success-soft)] text-[var(--qa-success-strong)]",
    dotClassName: "bg-[var(--qa-success)]",
  },
  closed: {
    // Deliberately the quietest of the seven — an outline rather than a
    // fill, so "closed" recedes instead of competing with live statuses
    // (and so it reads differently from "submitted", which shares its ink).
    label: "Closed",
    className: "border border-[var(--border)] text-[var(--muted-foreground)]",
    dotClassName: "bg-[var(--qa-slate)]",
  },
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${style.className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dotClassName}`} />
      {style.label}
    </span>
  );
}
