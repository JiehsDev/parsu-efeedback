// src/components/analytics/TrendChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  month: string;
  volume: number;
  slaCompliancePercent: number;
}

// Formats a compact spoken-word summary for the chart's aria-label — screen
// reader users get this instead of trying to parse an SVG line chart.
function summarize(data: TrendPoint[]): string {
  if (data.length === 0) return "No trend data available.";
  const totalVolume = data.reduce((sum, p) => sum + p.volume, 0);
  // Safe: the length check above guarantees these exist, but
  // noUncheckedIndexedAccess can't infer that from array indexing.
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const direction =
    last.volume === first.volume ? "flat" : last.volume > first.volume ? "up" : "down";
  return (
    `Line chart of complaint volume and SLA compliance across ${data.length} months, ` +
    `from ${first.month} to ${last.month}. Total volume ${totalVolume}, trending ${direction}. ` +
    `Most recent month (${last.month}): ${last.volume} complaints, ${last.slaCompliancePercent}% SLA compliant. ` +
    `Full monthly breakdown follows in the adjacent table.`
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const label = summarize(data);

  return (
    <div>
      {/* role="img" + aria-label gives assistive tech a spoken summary in
          place of the raw SVG (WCAG 1.1.1); the chart markup itself is
          aria-hidden since it's not meaningfully navigable node-by-node,
          and the sr-only table below is the full data-equivalent (WCAG
          1.4.1 — the chart also can't be the *only* way to get this data). */}
      <div role="img" aria-label={label} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "12px",
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="volume"
              name="Complaint Volume"
              stroke="var(--secondary)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="slaCompliancePercent"
              name="SLA Compliance %"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Visually hidden, screen-reader-only equivalent of the chart data —
          not decorative, so it stays in the accessibility tree even though
          the chart above is aria-hidden. Dashed stroke on the SLA line
          above is the same "don't rely on color alone" idea (WCAG 1.4.1)
          applied to the visual chart itself. */}
      <table className="sr-only">
        <caption>Monthly complaint volume and SLA compliance</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Complaint volume</th>
            <th scope="col">SLA compliance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.month}>
              <th scope="row">{p.month}</th>
              <td>{p.volume}</td>
              <td>{p.slaCompliancePercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
