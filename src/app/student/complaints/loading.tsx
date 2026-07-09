// src/app/student/complaints/loading.tsx
import { TableSkeleton } from "@/components/shared/Skeleton";

export default function Loading() {
  return <TableSkeleton rows={6} cols={5} />;
}
