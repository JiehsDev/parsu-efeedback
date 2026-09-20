// src/app/admin/dashboard/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

const CARD = "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-col gap-4 pb-2">
      <Skeleton className="h-6 w-40" />

      <div className="grid grid-cols-2 gap-1.5 sm:hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-1.5 py-2.5"
          >
            <Skeleton className="mx-auto h-5 w-6" />
            <Skeleton className="mx-auto mt-1.5 h-2.5 w-10" />
          </div>
        ))}
      </div>

      <div className="hidden gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-3.5" />
            </div>
            <Skeleton className="mt-2.5 h-5 w-12" />
            <Skeleton className="mt-1.5 h-2.5 w-16" />
          </div>
        ))}
      </div>

      {/* CONFIG HEALTH (wide) · USER ROLES · RECENT ACTIVITY */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${CARD} xl:col-span-2`}>
          <Skeleton className="h-2.5 w-32" />
          <div className="mt-2.5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <Skeleton className="h-2.5 w-16" />
          <div className="flex items-center justify-center py-2">
            <Skeleton className="h-[112px] w-[112px] rounded-full" />
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-2.5 w-6" />
              </div>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <Skeleton className="h-2.5 w-24" />
          <div className="mt-2.5 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLA HEATMAP · LINE CHART (wide) · BAR */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={CARD}>
          <Skeleton className="h-2.5 w-20" />
          <div className="mt-2.5 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className={`${CARD} xl:col-span-2`}>
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-3 h-[220px] w-full rounded-lg sm:h-[260px]" />
        </div>

        <div className={CARD}>
          <Skeleton className="h-2.5 w-20" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-2.5 w-[76px] shrink-0" />
                <Skeleton className="h-[7px] flex-1" />
                <Skeleton className="h-2.5 w-6 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
