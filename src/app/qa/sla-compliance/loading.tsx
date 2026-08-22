// src/app/qa/sla-compliance/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-11 w-28 rounded-2xl" />
            <Skeleton className="h-11 w-36 rounded-2xl" />
            <Skeleton className="h-11 w-40 rounded-2xl" />
          </div>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>

      <div>
        <Skeleton className="mb-3 h-3 w-36" />
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <span className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="mt-2 h-1.5 w-full max-w-40 rounded-full" />
                </span>
                <Skeleton className="h-3 w-24 shrink-0" />
                <Skeleton className="h-4 w-10 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-11 w-48 rounded-2xl" />
        </div>
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="mt-1.5 h-3 w-32" />
                </span>
                <Skeleton className="h-3 w-20 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
