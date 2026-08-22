// src/components/shared/StatCard.tsx
import type { LucideIcon } from "lucide-react";

export interface StatCardData {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tint: string;
  chipBorder: string;
  chipBg: string;
  chipText: string;
  iconColor?: string;
  delta?: string;
  deltaColor?: string;
}

export function StatCard({ stat, compact = false }: { stat: StatCardData; compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {stat.label}
          </p>
          <stat.icon
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: stat.iconColor ?? "var(--muted-foreground)" }}
          />
        </div>
        <p className="qa-tabular mt-1.5 text-[22px] leading-none font-bold tracking-tight text-[var(--foreground)]">
          {stat.value}
        </p>
        {stat.delta && (
          <p
            className="mt-1 text-[10.5px] font-semibold"
            style={{ color: stat.deltaColor ?? "var(--muted-foreground)" }}
          >
            {stat.delta}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tint}`}>
        <stat.icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--foreground)]">
        {stat.value}
      </p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{stat.label}</p>
      {stat.hint && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{stat.hint}</p>}
    </div>
  );
}

export function StatChip({ stat }: { stat: StatCardData }) {
  return (
    <div className={`rounded-xl border px-1.5 py-2.5 text-center ${stat.chipBorder} ${stat.chipBg}`}>
      <p className={`text-lg leading-none font-bold tracking-tight ${stat.chipText}`}>
        {stat.value}
      </p>
      <p className="mt-1 text-[10px] leading-tight text-[var(--muted-foreground)]">{stat.label}</p>
    </div>
  );
}
