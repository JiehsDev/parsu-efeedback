// src/app/staff/dashboard/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-1.5 py-2.5">
            <Skeleton className="mx-auto h-5 w-6" />
            <Skeleton className="mx-auto mt-1.5 h-2.5 w-10" />
          </div>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="mt-4 h-8 w-12" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
