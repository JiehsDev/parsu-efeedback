// src/components/shared/StatusBadge.tsx
import type { ComplaintStatus } from "@/lib/constants";

const STATUS_STYLES: Record<
  ComplaintStatus,
  { label: string; className: string; dotClassName: string }
> = {
  submitted: {
    label: "Submitted",
    className: "bg-[var(--muted)] text-[var(--muted-foreground)]",
    dotClassName: "bg-[var(--muted-foreground)]",
  },
  assigned: {
    label: "Assigned",
    className: "bg-[var(--secondary)]/20 text-[var(--secondary)]",
    dotClassName: "bg-[var(--secondary)]",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-[var(--primary)]/20 text-[var(--primary)]",
    dotClassName: "bg-[var(--primary)]",
  },
  pending_information: {
    label: "Pending Information",
    className: "bg-amber-500/20 text-amber-400",
    dotClassName: "bg-amber-400",
  },
  escalated: {
    label: "Escalated",
    className: "bg-[var(--destructive)]/20 text-[var(--destructive)]",
    dotClassName: "bg-[var(--destructive)]",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/20 text-emerald-400",
    dotClassName: "bg-emerald-400",
  },
  closed: {
    label: "Closed",
    className: "bg-[var(--border)] text-[var(--muted-foreground)]",
    dotClassName: "bg-[var(--muted-foreground)]",
  },
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dotClassName}`} />
      {style.label}
    </span>
  );
}
