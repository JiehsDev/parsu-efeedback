// src/components/reports/ReportStatusBadge.tsx
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  generating: "bg-[var(--secondary)]/20 text-[var(--secondary)]",
  ready: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-[var(--destructive)]/20 text-[var(--destructive)]",
};

export function ReportStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLES[status] ?? STATUS_STYLES.pending
      }`}
    >
      {status}
    </span>
  );
}
