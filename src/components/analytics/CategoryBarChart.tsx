// src/components/analytics/CategoryBarChart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TruncatedAxisTick } from "./TruncatedAxisTick";

type CategoryPoint = { category: string; volume: number };

// Same reasoning as TrendChart's summarize(): a spoken-word equivalent for
// the aria-label, since a horizontal bar chart's SVG is not meaningfully
// navigable by assistive tech on its own (WCAG 1.1.1).
function summarize(data: CategoryPoint[]): string {
  if (data.length === 0) return "No category data available.";
  const total = data.reduce((sum, d) => sum + d.volume, 0);
  const top = data.reduce((max, d) => (d.volume > max.volume ? d : max), data[0]!);
  return (
    `Horizontal bar chart of complaint volume by category, ${data.length} categories, ` +
    `${total} complaints total. Largest: ${top.category} with ${top.volume}. ` +
    `Full breakdown follows in the adjacent table.`
  );
}

export function CategoryBarChart({ data }: { data: CategoryPoint[] }) {
  const label = summarize(data);

  return (
    <div>
      <div role="img" aria-label={label} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis
              type="category"
              dataKey="category"
              stroke="var(--muted-foreground)"
              fontSize={11}
              width={92}
              // Full names are long enough to wrap to 3-4 lines at any fixed
              // width narrow enough to leave room for the bars themselves —
              // truncate on-axis and let the tooltip carry the full name.
              tick={<TruncatedAxisTick maxLength={13} />}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="volume" fill="var(--secondary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Complaint volume by category</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.category}>
              <th scope="row">{d.category}</th>
              <td>{d.volume}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
