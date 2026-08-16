// src/app/admin/dashboard/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-2.5">
            <Skeleton className="mx-auto h-5 w-6" />
            <Skeleton className="mx-auto mt-1.5 h-2.5 w-14" />
          </div>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="mt-4 h-8 w-12" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      <div>
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
