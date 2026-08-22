// src/app/student/dashboard/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

// Mirrors the real dashboard's shape. The previous version rendered three
// StatCardSkeletons for stat cards the page no longer draws, so the loading
// state promised a layout that never arrived and visibly reflowed on paint.
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[var(--card)] px-4 py-3">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="hidden h-3 w-32 shrink-0 sm:block" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="hidden h-3 w-16 shrink-0 sm:block" />
              <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
              <Skeleton className="hidden h-3 w-12 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
