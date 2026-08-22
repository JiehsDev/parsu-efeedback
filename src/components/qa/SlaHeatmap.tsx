// src/components/qa/SlaHeatmap.tsx
import type { SlaComplianceByOfficePoint } from "@/features/analytics/services/analytics.service";

// Bands must stay in sync with the SLA Compliance page (src/app/qa/sla-compliance/page.tsx)
// so the two surfaces never disagree about what counts as "compliant."
function toneFor(percent: number) {
  if (percent >= 80) return { bg: "var(--qa-success-soft)", text: "var(--qa-success)" };
  if (percent >= 50) return { bg: "var(--qa-amber-soft)", text: "var(--qa-amber)" };
  return { bg: "color-mix(in oklab, var(--destructive) 12%, var(--card))", text: "var(--destructive)" };
}

function summarize(data: SlaComplianceByOfficePoint[]): string {
  if (data.length === 0) return "No SLA compliance data available.";
  return (
    `Heatmap of SLA compliance by office, ${data.length} offices: ` +
    data.map((d) => `${d.office} ${d.percent}%`).join(", ") +
    ". Full breakdown follows in the adjacent table."
  );
}

export function SlaHeatmap({
  data,
  compact = false,
}: {
  data: SlaComplianceByOfficePoint[];
  compact?: boolean;
}) {
  const label = summarize(data);

  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No data yet.</p>;
  }

  // No overflow/scroll clipping here — a hover tooltip needs to pop outside
  // a row's own box, which an overflow-y-auto ancestor would cut off for
  // whichever row sits at the clipped edge. Cap the row count instead so
  // the compact list never needs to scroll in the first place.
  const visibleData = compact ? data.slice(0, 8) : data;

  return (
    <div>
      <div
        role="img"
        aria-label={label}
        className={
          compact
            ? "grid grid-cols-1 gap-2"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {visibleData.map((d) => {
          const tone = toneFor(d.percent);
          return compact ? (
            <div
              key={d.office}
              className="group relative flex items-center justify-between gap-2 rounded-lg px-3 py-2"
              style={{ background: tone.bg }}
            >
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-[var(--foreground)] px-2.5 py-1.5 text-[10px] whitespace-nowrap text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              >
                <p className="font-semibold">{d.office}</p>
                <p className="qa-tabular">
                  {d.compliant}/{d.total} within SLA ({d.percent}%)
                </p>
              </div>
              <span className="min-w-0 cursor-pointer truncate text-[10.5px] font-medium text-[var(--foreground)]">
                {d.office}
              </span>
              <span className="qa-tabular shrink-0 text-[11.5px] font-bold" style={{ color: tone.text }}>
                {d.percent}%
              </span>
            </div>
          ) : (
            <div
              key={d.office}
              className="group relative cursor-pointer rounded-2xl p-4"
              style={{ background: tone.bg }}
            >
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-[var(--foreground)] px-2.5 py-1.5 text-[10px] whitespace-nowrap text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              >
                <p className="font-semibold">{d.office}</p>
                <p className="qa-tabular">
                  {d.compliant}/{d.total} within SLA ({d.percent}%)
                </p>
              </div>
              <p className="truncate text-xs font-medium text-[var(--foreground)]">{d.office}</p>
              <p className="qa-tabular mt-2 text-2xl font-bold tracking-tight" style={{ color: tone.text }}>
                {d.percent}%
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                {d.compliant}/{d.total} within SLA
              </p>
            </div>
          );
        })}
      </div>

      {/* A <table> ignores an explicit tiny width/height (row/column
          layout sizes from content, not the declared box), so the
          sr-only class on the table itself doesn't actually constrain
          its rendered size — wrap it in a div instead, which does. */}
      <div className="sr-only">
        <table>
          <caption>SLA compliance by office</caption>
          <thead>
            <tr>
              <th scope="col">Office</th>
              <th scope="col">Compliant</th>
              <th scope="col">Total</th>
              <th scope="col">Percent</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.office}>
                <th scope="row">{d.office}</th>
                <td>{d.compliant}</td>
                <td>{d.total}</td>
                <td>{d.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
