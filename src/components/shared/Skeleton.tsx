import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// src/components/shared/Skeleton.tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "max-w-full animate-pulse rounded-[var(--radius)] bg-[var(--muted)]",
        className,
      )}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
      <div className="bg-[var(--muted)] px-4 py-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 bg-[var(--card)] px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-2 h-7 w-12" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  );
}

export function ListRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One accessible loading region; individual placeholder bars stay decorative. */
export function SkeletonPage({
  children,
  label,
  className = "space-y-5",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      data-loading=""
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`workspace-page ${className}`}
    >
      {children}
    </div>
  );
}

export function ComplaintDetailSkeleton({ student = false }: { student?: boolean }) {
  return (
    <SkeletonPage label="Loading complaint details" className={student ? "space-y-6" : "space-y-5"}>
      <Skeleton className="h-5 w-36" />
      <div
        className={
          student
            ? "flex flex-wrap items-start justify-between gap-4"
            : "border-b border-[var(--border)] pb-5"
        }
      >
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1 h-8 w-full max-w-2xl" />
          {!student && <Skeleton className="mt-2 h-6 w-24 rounded-full" />}
        </div>
        {student && <Skeleton className="h-6 w-24 shrink-0 rounded-full xl:hidden" />}
      </div>
      <div className="reading-layout">
        <div className="min-w-0 space-y-5">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-5 w-24" />
            <div className="mt-2 max-w-[75ch] space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 border-l border-[var(--border)] pl-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="min-w-0 space-y-5">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-5 w-28" />
            <div className={student ? "mt-4 grid grid-cols-2 gap-4" : "mt-3 space-y-3"}>
              {Array.from({ length: student ? 2 : 8 }).map((_, i) => (
                <div key={i} className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-5 w-20" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: student ? 5 : 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </SkeletonPage>
  );
}
