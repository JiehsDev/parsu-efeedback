// src/components/analytics/QaDonutChart.tsx
"use client";

import { useState } from "react";

export interface QaDonutSlice {
  label: string;
  value: number;
  color: string;
}

const SIZE = 100;
const CENTER = SIZE / 2;
const RADIUS = 38;
const STROKE = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function summarize(data: QaDonutSlice[], subject: string): string {
  if (data.length === 0) return `No ${subject} data available.`;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const parts = data.map((d) => {
    const percent = total > 0 ? Math.round((d.value / total) * 100) : 0;
    return `${d.label} ${d.value} (${percent}%)`;
  });
  return `Donut chart of complaint volume by ${subject}, ${total} complaints total: ${parts.join(", ")}. Full breakdown follows in the adjacent table.`;
}

export function QaDonutChart({
  data,
  centerLabel,
  subject,
}: {
  data: QaDonutSlice[];
  centerLabel: string;
  subject: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const label = summarize(data, subject);

  let cumulative = 0;
  const slices = data.map((d, i) => {
    const sliceLength = total > 0 ? (d.value / total) * CIRCUMFERENCE : 0;
    const offset = cumulative;
    cumulative += sliceLength;
    const percent = total > 0 ? Math.round((d.value / total) * 100) : 0;
    return { ...d, index: i, sliceLength, offset, percent };
  });

  const activeSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div>
      <div role="img" aria-label={label} className="flex items-center justify-center py-2">
        <div className="relative h-[112px] w-[112px]">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width="100%"
            height="100%"
            aria-hidden="true"
            className="-rotate-90"
          >
            {total === 0 ? (
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
            ) : (
              slices.map((s) => (
                <circle
                  key={s.label}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === s.index ? STROKE + 2 : STROKE}
                  strokeDasharray={`${s.sliceLength} ${CIRCUMFERENCE - s.sliceLength}`}
                  strokeDashoffset={-s.offset}
                  opacity={hovered === null || hovered === s.index ? 1 : 0.35}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHovered(s.index)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))
            )}
          </svg>
          <div className="pointer-events-none absolute inset-[19px] flex flex-col items-center justify-center rounded-full bg-[var(--card)] text-center">
            {activeSlice ? (
              <>
                <span className="qa-tabular text-[15px] font-bold text-[var(--foreground)]">
                  {activeSlice.value}
                </span>
                <span className="max-w-[70px] truncate text-[8.5px] font-semibold text-[var(--muted-foreground)]">
                  {activeSlice.label}
                </span>
                <span className="text-[8px] font-semibold" style={{ color: activeSlice.color }}>
                  {activeSlice.percent}%
                </span>
              </>
            ) : (
              <>
                <span className="qa-tabular text-[16px] font-bold text-[var(--foreground)]">
                  {total}
                </span>
                <span className="text-[8.5px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                  {centerLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {slices.map((d) => (
          <div
            key={d.label}
            onMouseEnter={() => setHovered(d.index)}
            onMouseLeave={() => setHovered(null)}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 text-[10.5px] transition-colors ${
              hovered === d.index ? "bg-[var(--muted)]" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              <span className="truncate text-[var(--muted-foreground)]">{d.label}</span>
            </span>
            <span className="qa-tabular shrink-0 font-semibold text-[var(--foreground)]">
              {d.value}
            </span>
          </div>
        ))}
      </div>

      {/* A <table> ignores an explicit tiny width/height (row/column
          layout sizes from content, not the declared box), so the
          sr-only class on the table itself doesn't actually constrain
          its rendered size — wrap it in a div instead, which does. */}
      <div className="sr-only">
        <table>
          <caption>Complaint volume by {subject}</caption>
          <thead>
            <tr>
              <th scope="col">{subject}</th>
              <th scope="col">Volume</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
