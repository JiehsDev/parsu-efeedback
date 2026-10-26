import { Skeleton, SkeletonPage } from "./Skeleton";
import { ComplaintRowHeader } from "./ComplaintListRow";

export function ComplaintDashboardSkeleton() {
  return (
    <SkeletonPage label="Loading dashboard" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-1 h-5 w-80" />
        </div>
        <Skeleton className="h-9 w-24" />
      </header>
      <div className="dashboard-grid">
        <section className="col-span-2 flex flex-col justify-between rounded-lg bg-[var(--primary)] p-4 xl:col-span-3 xl:row-span-2">
          <Skeleton className="h-4 w-28 bg-[var(--primary-foreground)]/20" />
          <Skeleton className="my-3 h-10 w-16 bg-[var(--primary-foreground)]/20" />
          <div className="border-t border-current/20 pt-2">
            <Skeleton className="h-4 w-40 bg-[var(--primary-foreground)]/20" />
          </div>
        </section>
        <section className="dashboard-panel col-span-2 flex flex-col justify-between xl:col-span-3 xl:row-span-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="my-3 h-10 w-20" />
          <div>
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="mt-2 h-4 w-52" />
          </div>
        </section>
        {Array.from({ length: 6 }).map((_, i) => (
          <section
            key={i}
            className="dashboard-metric flex min-h-[76px] flex-col justify-between xl:col-span-2"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1 h-8 w-12" />
          </section>
        ))}
        <section className="dashboard-panel col-span-2 flex min-h-[320px] flex-col md:col-span-4 xl:col-span-7">
          <Skeleton className="mb-3 h-5 w-36" />
          <Skeleton className="h-64 min-h-64 w-full flex-1" />
        </section>
        <section className="dashboard-panel col-span-2 flex min-h-[320px] flex-col md:col-span-4 xl:col-span-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1 h-4 w-48" />
          <div className="mt-2 divide-y divide-[var(--border)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-1 py-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </section>
        <section className="dashboard-panel col-span-2 md:col-span-4 xl:col-span-5">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="h-[164px] w-full" />
        </section>
        <section className="dashboard-panel col-span-2 xl:col-span-4">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="h-40 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1 h-4 w-32" />
                <Skeleton className="h-1 w-full" />
              </div>
            ))}
          </div>
        </section>
        <section className="dashboard-panel col-span-2 xl:col-span-3">
          <Skeleton className="mb-2 h-5 w-24" />
          <div className="flex h-[164px] items-center justify-center">
            <Skeleton className="h-28 w-28 rounded-full" />
          </div>
        </section>
      </div>
    </SkeletonPage>
  );
}

export function ComplaintRowsSkeleton({
  rows = 6,
  recent = false,
}: {
  rows?: number;
  recent?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      {recent && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      )}
      <ComplaintRowHeader />
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-2.5">
            <Skeleton className="hidden h-4 w-[10.5rem] shrink-0 sm:block" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="mt-0.5 h-4 w-32 sm:hidden" />
            </div>
            <div className="hidden w-24 shrink-0 sm:block">
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
            <div className="shrink-0 sm:w-[7.5rem]">
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="hidden w-16 shrink-0 sm:block">
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentDashboardSkeleton() {
  return (
    <SkeletonPage label="Loading student dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden border-y border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[100px] items-center gap-2.5 bg-[var(--card)] px-3.5 py-4 sm:px-4"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-1 h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-5 shrink-0" />
          </div>
        ))}
      </div>
      <ComplaintRowsSkeleton recent />
    </SkeletonPage>
  );
}

export function StudentComplaintsSkeleton() {
  return (
    <SkeletonPage label="Loading your complaints">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="flex gap-5 border-b border-[var(--border)] pb-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-full sm:max-w-xs" />
        <div className="flex min-w-0 gap-2.5">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <ComplaintRowsSkeleton />
    </SkeletonPage>
  );
}

export function StaffQueueSkeleton({ sla = false }: { sla?: boolean }) {
  return (
    <SkeletonPage label={sla ? "Loading SLA tracker" : "Loading complaint queue"}>
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-1 h-8 w-56 sm:h-9" />
          <Skeleton className="mt-1 h-5 w-80" />
        </div>
        <Skeleton className="h-4 w-32" />
      </header>
      <div
        className={
          sla ? "grid grid-cols-2 gap-3 2xl:grid-cols-4" : "grid grid-cols-2 gap-3 xl:grid-cols-4"
        }
      >
        {Array.from({ length: 4 }).map((_, i) =>
          sla ? (
            <div
              key={i}
              className="flex min-h-[84px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3"
            >
              <Skeleton className="h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-4 w-28" />
              </div>
              <Skeleton className="h-6 w-5 shrink-0" />
            </div>
          ) : (
            <div
              key={i}
              className="flex min-h-[110px] flex-col justify-between gap-2 border-b border-[var(--border)] px-3 py-3"
            >
              <div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-1 h-4 w-36" />
              </div>
              <Skeleton className="h-6 w-8" />
            </div>
          ),
        )}
      </div>
      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--muted)]/55 p-1">
          {Array.from({ length: sla ? 4 : 6 }).map((_, i) => (
            <div key={i} className="px-3 py-1.5">
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div
          className={
            sla
              ? "flex flex-wrap gap-2"
              : "grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(13rem,1fr)_repeat(4,minmax(8rem,auto))_auto]"
          }
        >
          {Array.from({ length: sla ? 4 : 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className={sla ? (i === 0 ? "h-9 w-full sm:w-48" : "h-9 w-28") : "h-9 w-full"}
            />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-0.5 h-4 w-64" />
        </div>
        <div
          className={
            sla
              ? "hidden gap-3 border-b border-[var(--border)] bg-[var(--muted)]/35 px-4 py-2 2xl:grid 2xl:grid-cols-[8.5rem_minmax(14rem,1fr)_5.5rem_7.5rem_8rem_8.5rem_5rem]"
              : "hidden gap-3 border-b border-[var(--border)] bg-[var(--muted)]/35 px-4 py-2 2xl:grid 2xl:grid-cols-[9rem_minmax(15rem,1fr)_8rem_8rem_9rem_7rem_4rem]"
          }
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-16" />
          ))}
        </div>
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-l-4 border-transparent px-4 py-3">
              <div
                className={
                  sla
                    ? "grid items-center gap-3 2xl:grid-cols-[8.5rem_minmax(14rem,1fr)_5.5rem_7.5rem_8rem_8.5rem_5rem]"
                    : "grid items-center gap-3 2xl:grid-cols-[9rem_minmax(15rem,1fr)_8rem_8rem_9rem_7rem_4rem]"
                }
              >
                <Skeleton className="h-4 w-32" />
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-44" />
                  {!sla && <Skeleton className="h-4 w-28" />}
                </div>
                <Skeleton className="h-6 w-16 rounded-md" />
                <Skeleton className="hidden h-6 w-24 rounded-full 2xl:block" />
                <Skeleton className="hidden h-5 w-24 2xl:block" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="hidden h-4 w-12 2xl:block" />
              </div>
              <div className="mt-2 flex gap-2 2xl:hidden">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
