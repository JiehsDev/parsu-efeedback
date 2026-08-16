// src/components/shared/Skeleton.tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius)] bg-[var(--muted)] ${className}`} />;
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
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
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

export function ComplaintDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-4 w-32" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-2 h-7 w-64" />
        </div>
        <Skeleton className="h-6 w-20 shrink-0 rounded-full lg:hidden" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-4 w-16" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="mt-1.5 h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-full" />
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
