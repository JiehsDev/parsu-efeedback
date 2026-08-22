// src/components/analytics/PriorityPieChart.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6b7280",
  medium: "var(--secondary)",
  high: "#d97706",
  critical: "var(--destructive)",
};

type PriorityPoint = { priority: string; volume: number };

// Same reasoning as TrendChart's summarize(): a spoken-word equivalent for
// the aria-label, since a pie chart's SVG is not meaningfully navigable by
// assistive tech on its own (WCAG 1.1.1).
function summarize(data: PriorityPoint[]): string {
  if (data.length === 0) return "No priority data available.";
  const total = data.reduce((sum, d) => sum + d.volume, 0);
  const parts = data.map((d) => {
    const percent = total > 0 ? Math.round((d.volume / total) * 100) : 0;
    return `${d.priority} ${d.volume} (${percent}%)`;
  });
  return `Pie chart of complaint volume by priority, ${total} complaints total: ${parts.join(", ")}. Full breakdown follows in the adjacent table.`;
}

export function PriorityPieChart({
  data,
  heightClassName = "h-72",
}: {
  data: PriorityPoint[];
  heightClassName?: string;
}) {
  const volumeByPriority = Object.fromEntries(data.map((d) => [d.priority, d.volume]));
  const label = summarize(data);

  return (
    <div>
      <div role="img" aria-label={label} className={`${heightClassName} w-full`}>
        <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
          <PieChart>
            <Pie data={data} dataKey="volume" nameKey="priority" cx="50%" cy="50%" outerRadius="70%">
              {data.map((entry) => (
                <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] ?? "#6b7280"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "12px",
              }}
            />
            {/* Inline slice labels get clipped/overlap at this chart size and
                are unreachable on touch devices anyway — the legend carries
                the count instead, so the number is visible without a hover. */}
            <Legend
              formatter={(value: string) => `${value} (${volumeByPriority[value] ?? 0})`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* A <table> ignores an explicit tiny width/height (row/column
          layout sizes from content, not the declared box), so the
          sr-only class on the table itself doesn't actually constrain
          its rendered size — wrap it in a div instead, which does. */}
      <div className="sr-only">
        <table>
          <caption>Complaint volume by priority</caption>
          <thead>
            <tr>
              <th scope="col">Priority</th>
              <th scope="col">Volume</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.priority}>
                <th scope="row">{d.priority}</th>
                <td>{d.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
