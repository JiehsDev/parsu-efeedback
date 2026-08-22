// src/app/dean/dashboard/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

const CARD = "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4";

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4">
      <Skeleton className="h-6 w-32" />

      <div className="grid grid-cols-4 gap-1.5 sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-1.5 py-2.5">
            <Skeleton className="mx-auto h-5 w-6" />
            <Skeleton className="mx-auto mt-1.5 h-2.5 w-10" />
          </div>
        ))}
      </div>

      <div className="hidden gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-3.5" />
            </div>
            <Skeleton className="mt-2.5 h-5 w-12" />
            <Skeleton className="mt-1.5 h-2.5 w-16" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={CARD}>
          <Skeleton className="h-2.5 w-24" />
          <div className="mt-2.5 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-5" />
              </div>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <Skeleton className="h-2.5 w-16" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-2.5 w-[76px] shrink-0" />
                <Skeleton className="h-[7px] flex-1" />
                <Skeleton className="h-2.5 w-6 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${CARD} flex min-h-0 flex-1 flex-col`}>
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 min-h-0 flex-1 w-full rounded-lg" />
      </div>
    </div>
  );
}
