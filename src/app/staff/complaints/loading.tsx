// src/app/staff/complaints/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] sm:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-2 py-2.5">
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
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      <Skeleton className="h-10 w-72 rounded-full" />

      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
