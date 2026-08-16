// src/components/shared/NotificationIcon.tsx
const ICON_COLOR: Record<string, string> = {
  complaint_submitted: "text-[var(--secondary)]",
  complaint_assigned: "text-[var(--primary)]",
  status_updated: "text-[var(--secondary)]",
  sla_warning: "text-amber-400",
  escalation: "text-[var(--destructive)]",
  complaint_resolved: "text-emerald-400",
  report_generated: "text-[var(--muted-foreground)]",
};

export function NotificationDot({ type }: { type: string }) {
  return (
    <span
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full bg-current ${
        ICON_COLOR[type] ?? "text-[var(--muted-foreground)]"
      }`}
    />
  );
}
