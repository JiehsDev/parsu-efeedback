// src/app/qa/sla-compliance/loading.tsx
import { Skeleton, ListRowsSkeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <ListRowsSkeleton rows={5} />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <ListRowsSkeleton rows={4} />
      </div>
    </div>
  );
}
