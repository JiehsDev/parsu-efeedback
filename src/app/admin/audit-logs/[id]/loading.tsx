// src/app/admin/audit-logs/[id]/loading.tsx
import { Skeleton, SkeletonPage } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading audit log details" className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
        </div>
        <div className="text-right">
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="mt-2 ml-auto h-3 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <Skeleton className="h-4 w-32" />
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

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
