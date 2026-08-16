// src/app/staff/sla/loading.tsx
import { Skeleton, ListRowsSkeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
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
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <Skeleton className="mt-3 h-7 w-10" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-3 w-20" />
        <ListRowsSkeleton rows={4} />
      </div>
    </div>
  );
}
