// src/app/admin/offices/[id]/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-4 w-28" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-2 h-5 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
            <Skeleton className="h-4 w-24" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-1.5 h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
