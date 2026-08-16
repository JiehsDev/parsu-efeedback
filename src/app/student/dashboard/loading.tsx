// src/app/student/dashboard/loading.tsx
import { Skeleton, StatCardSkeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2.5">
            <Skeleton className="mx-auto h-5 w-6" />
            <Skeleton className="mx-auto mt-1.5 h-2.5 w-12" />
          </div>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <Skeleton className="h-5 w-28" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
