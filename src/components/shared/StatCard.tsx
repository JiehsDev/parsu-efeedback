// src/components/shared/StatCard.tsx
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

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
  /** Where this stat's tile links to, e.g. a pre-filtered queue view. */
  href?: string;
  /**
   * Render as a bold tinted card (using chipBorder/chipBg/chipText) instead
   * of a plain card with a tinted icon. Meant to be conditional on the
   * value itself — e.g. only when an overdue count is above zero — so the
   * color communicates live status rather than decorating every tile.
   */
  emphasize?: boolean;
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

  const labelClassName = stat.emphasize
    ? `${stat.chipText} opacity-80`
    : "text-[var(--muted-foreground)]";
  const numberClassName = stat.emphasize ? stat.chipText : "text-[var(--foreground)]";

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[11px] font-semibold tracking-wide uppercase ${labelClassName}`}>
          {stat.label}
        </p>
        <div className="relative h-4 w-4 shrink-0">
          <stat.icon
            className="absolute inset-0 h-4 w-4 transition-opacity group-hover:opacity-0"
            style={{ color: stat.iconColor ?? "var(--muted-foreground)" }}
          />
          {stat.href && (
            <ArrowUpRight
              className="absolute inset-0 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: stat.iconColor ?? "var(--muted-foreground)" }}
            />
          )}
        </div>
      </div>
      <p className={`qa-tabular mt-3 text-4xl font-bold tracking-tight ${numberClassName}`}>
        {stat.value}
      </p>
      {stat.hint && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{stat.hint}</p>}
    </>
  );

  const cardClassName = `group relative rounded-3xl border p-5 transition-all ${
    stat.emphasize ? `${stat.chipBorder} ${stat.chipBg}` : "border-[var(--border)] bg-[var(--card)]"
  } ${stat.href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`;

  if (stat.href) {
    return (
      <Link href={stat.href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

export function StatChip({ stat }: { stat: StatCardData }) {
  const content = (
    <>
      <p className={`text-lg leading-none font-bold tracking-tight ${stat.chipText}`}>
        {stat.value}
      </p>
      <p className="mt-1 text-[10px] leading-tight text-[var(--muted-foreground)]">{stat.label}</p>
    </>
  );
  const chipClassName = `rounded-xl border px-1.5 py-2.5 text-center ${stat.chipBorder} ${stat.chipBg}`;

  if (stat.href) {
    return (
      <Link href={stat.href} className={chipClassName}>
        {content}
      </Link>
    );
  }

  return <div className={chipClassName}>{content}</div>;
}
