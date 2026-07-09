// src/components/analytics/PriorityPieChart.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6b7280",
  medium: "var(--secondary)",
  high: "#d97706",
  critical: "var(--destructive)",
};

export function PriorityPieChart({ data }: { data: { priority: string; volume: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="volume"
            nameKey="priority"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(props: any) => `${props.priority}: ${props.volume}`}
          >
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
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
