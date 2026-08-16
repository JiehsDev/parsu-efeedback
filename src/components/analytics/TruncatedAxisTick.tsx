// src/components/analytics/TruncatedAxisTick.tsx
"use client";

// Recharts silently drops ticks that don't fit rather than shrinking or
// wrapping them, so long category/college names on a narrow chart either
// wrap to several lines (eating the plot area) or vanish entirely. This
// caps the rendered label at a fixed length and leans on each chart's
// <Tooltip> to surface the full name on hover/tap.
export function TruncatedAxisTick({
  x,
  y,
  payload,
  maxLength = 13,
  angle = 0,
  textAnchor = "end",
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  maxLength?: number;
  angle?: number;
  textAnchor?: "end" | "start" | "middle";
}) {
  const label = payload?.value ?? "";
  const truncated = label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;

  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor={textAnchor}
      fontSize={11}
      fill="var(--muted-foreground)"
      transform={angle ? `rotate(${angle}, ${x}, ${y})` : undefined}
    >
      {truncated}
    </text>
  );
}
