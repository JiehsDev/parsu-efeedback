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
      <div className="flex min-h-[84px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.chipBg} ${stat.chipText}`}>
          <stat.icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[var(--foreground)]">{stat.label}</span>
          {stat.hint && <span className="mt-1 block truncate text-[11px] text-[var(--muted-foreground)]">{stat.hint}</span>}
          {stat.delta && <span className="mt-1 block truncate text-[10.5px] font-semibold" style={{ color: stat.deltaColor ?? "var(--muted-foreground)" }}>{stat.delta}</span>}
        </span>
        <span className="qa-tabular shrink-0 text-2xl leading-none font-semibold tracking-tight text-[var(--foreground)]">{stat.value}</span>
      </div>
    );
  }

  const labelClassName = stat.emphasize
    ? `${stat.chipText} opacity-80`
    : "text-[var(--muted-foreground)]";
  const numberClassName = stat.emphasize ? stat.chipText : "text-[var(--foreground)]";

  const content = (
    <div className="flex min-h-[92px] items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.chipBg} ${stat.chipText}`}>
        <stat.icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-semibold ${labelClassName}`}>{stat.label}</span>
        {stat.hint && <span className="mt-1 block truncate text-[11px] text-[var(--muted-foreground)]">{stat.hint}</span>}
        {stat.delta && <span className="mt-1 block truncate text-[10.5px] font-semibold" style={{ color: stat.deltaColor ?? "var(--muted-foreground)" }}>{stat.delta}</span>}
      </span>
      <span className={`qa-tabular shrink-0 text-3xl leading-none font-bold tracking-tight ${numberClassName}`}>{stat.value}</span>
      {stat.href && <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
    </div>
  );

  const cardClassName = `group relative rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors ${
    stat.href ? "hover:bg-[var(--muted)]/45" : ""
  }`;

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
