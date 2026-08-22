// src/app/qa/complaints/loading.tsx
import { Skeleton } from "@/components/shared/Skeleton";

const STATUS_FILTER_WIDTHS = ["w-20", "w-20", "w-16", "w-20", "w-16", "w-16", "w-14"];

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-full max-w-xs rounded-full" />
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTER_WIDTHS.map((w, i) => (
          <Skeleton key={i} className={`h-7 ${w} rounded-full`} />
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <ul className="divide-y divide-[var(--border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <span className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-2 h-3 w-3/5" />
                <Skeleton className="mt-1.5 h-3 w-2/5" />
              </span>
              <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
