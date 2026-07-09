// src/app/dean/analytics/page.tsx — updated
"use client";

import { useEffect, useState } from "react";
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
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Complaint volume, category, and priority trends for your college.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : (
        <>
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="mb-4 text-sm font-medium text-[var(--foreground)]">Monthly Trend</h2>
            {trends.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Not enough data yet.</p>
            ) : (
              <TrendChart data={trends} />
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="mb-4 text-sm font-medium text-[var(--foreground)]">By Category</h2>
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>
              ) : (
                <CategoryBarChart data={categoryBreakdown} />
              )}
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="mb-4 text-sm font-medium text-[var(--foreground)]">By Priority</h2>
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
