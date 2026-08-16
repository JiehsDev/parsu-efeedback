// src/app/dean/analytics/page.tsx — updated
"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { TrendChart } from "@/components/analytics/TrendChart";
import { CategoryBarChart } from "@/components/analytics/CategoryBarChart";
import { PriorityPieChart } from "@/components/analytics/PriorityPieChart";

export default function DeanAnalyticsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [priorityBreakdown, setPriorityBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/trends")
      .then((res) => res.json())
      .then((data) => {
        setTrends(data.trends ?? []);
        setCategoryBreakdown(data.categoryBreakdown ?? []);
        setPriorityBreakdown(data.priorityBreakdown ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Analytics
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Complaint volume, category, and priority trends for your college.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <div
            role="region"
            aria-labelledby="dean-monthly-trend-heading"
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <h2
              id="dean-monthly-trend-heading"
              className="mb-4 text-sm font-semibold text-[var(--foreground)]"
            >
              Monthly Trend
            </h2>
            {trends.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Not enough data yet.</p>
            ) : (
              <TrendChart data={trends} />
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              role="region"
              aria-labelledby="dean-category-heading"
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
            >
              <h2 id="dean-category-heading" className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                By Category
              </h2>
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>
              ) : (
                <CategoryBarChart data={categoryBreakdown} />
              )}
            </div>

            <div
              role="region"
              aria-labelledby="dean-priority-heading"
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
            >
              <h2 id="dean-priority-heading" className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                By Priority
              </h2>
              {priorityBreakdown.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>
              ) : (
                <PriorityPieChart data={priorityBreakdown} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
