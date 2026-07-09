// src/app/qa/analytics/page.tsx
"use client";

import { useEffect, useState } from "react";
import { TrendChart } from "@/components/analytics/TrendChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CategoryBarChart } from "@/components/analytics/CategoryBarChart";
import { PriorityPieChart } from "@/components/analytics/PriorityPieChart";

export default function QaAnalyticsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [collegeComparison, setCollegeComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [priorityBreakdown, setPriorityBreakdown] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/analytics/trends")
      .then((res) => res.json())
      .then((data) => {
        setTrends(data.trends ?? []);
        setCollegeComparison(data.collegeComparison ?? []);
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
          Institution-wide complaint trends and SLA compliance.
        </p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-sm font-medium text-[var(--foreground)]">Monthly Trend</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
        ) : (
          <TrendChart data={trends} />
        )}
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-sm font-medium text-[var(--foreground)]">
          College Comparison — Volume
        </h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collegeComparison} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="college" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="volume" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
    </div>
  );
}
