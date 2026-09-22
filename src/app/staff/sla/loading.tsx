// src/app/staff/sla/loading.tsx
import { Skeleton, ListRowsSkeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3.5">
            <Skeleton className="mx-auto h-5 w-6" />
            <Skeleton className="mx-auto mt-1.5 h-2.5 w-12" />
            <Skeleton className="mx-auto mt-2 h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-3"><Skeleton className="h-12 w-full rounded-2xl" /><ListRowsSkeleton rows={6} /></div>
    </div>
  );
}
