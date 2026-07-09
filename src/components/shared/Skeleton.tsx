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
