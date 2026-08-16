// src/app/qa/analytics/page.tsx
"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { TrendChart } from "@/components/analytics/TrendChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CategoryBarChart } from "@/components/analytics/CategoryBarChart";
import { PriorityPieChart } from "@/components/analytics/PriorityPieChart";
import { TruncatedAxisTick } from "@/components/analytics/TruncatedAxisTick";

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
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Analytics
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Institution-wide complaint trends and SLA compliance.
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
            aria-labelledby="qa-monthly-trend-heading"
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <h2
              id="qa-monthly-trend-heading"
              className="mb-4 text-sm font-semibold text-[var(--foreground)]"
            >
              Monthly Trend
            </h2>
            <TrendChart data={trends} />
          </div>

          <div
            role="region"
            aria-labelledby="qa-college-comparison-heading"
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <h2
              id="qa-college-comparison-heading"
              className="mb-4 text-sm font-semibold text-[var(--foreground)]"
            >
              College Comparison — Volume
            </h2>
            <div
              role="img"
              aria-label={
                collegeComparison.length === 0
                  ? "No college comparison data available."
                  : `Horizontal bar chart comparing complaint volume across ${collegeComparison.length} colleges: ` +
                    collegeComparison
                      .map((c: any) => `${c.college} ${c.volume}`)
                      .join(", ") +
                    ". Full breakdown follows in the adjacent table."
              }
              className="h-72 w-full"
            >
              <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
                <BarChart
                  data={collegeComparison}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="college"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    width={92}
                    tick={<TruncatedAxisTick maxLength={13} />}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "1rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="volume" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Complaint volume by college</caption>
              <thead>
                <tr>
                  <th scope="col">College</th>
                  <th scope="col">Volume</th>
                </tr>
              </thead>
              <tbody>
                {collegeComparison.map((c: any) => (
                  <tr key={c.college}>
                    <th scope="row">{c.college}</th>
                    <td>{c.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              role="region"
              aria-labelledby="qa-category-heading"
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
            >
              <h2 id="qa-category-heading" className="mb-4 text-sm font-semibold text-[var(--foreground)]">
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
              aria-labelledby="qa-priority-heading"
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
            >
              <h2 id="qa-priority-heading" className="mb-4 text-sm font-semibold text-[var(--foreground)]">
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
