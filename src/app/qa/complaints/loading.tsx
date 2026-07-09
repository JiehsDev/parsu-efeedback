// src/app/student/complaints/[id]/loading.tsx
import { CardSkeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
