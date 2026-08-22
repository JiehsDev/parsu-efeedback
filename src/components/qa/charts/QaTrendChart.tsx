// src/components/qa/charts/QaTrendChart.tsx
interface TrendPoint {
  month: string;
  volume: number;
  slaCompliancePercent: number;
}

const W = 520;
const H = 170;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;

function summarize(data: TrendPoint[]): string {
  if (data.length === 0) return "No trend data available.";
  const totalVolume = data.reduce((sum, p) => sum + p.volume, 0);
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

// A single data point has no line to draw — pin it to a flat segment
// spanning the full width instead of the "M x,y" it would otherwise
// produce, which the area-fill path turns into a stray triangle spike
// down to the two bottom corners.
function points(data: TrendPoint[], key: "volume" | "slaCompliancePercent", max: number) {
  const n = data.length;
  const valueToY = (v: number) => H - PAD_BOTTOM - v * (H - PAD_TOP - PAD_BOTTOM);
  if (n <= 1) {
    const v = data[0]
      ? key === "slaCompliancePercent"
        ? data[0][key] / 100
        : data[0][key] / max
      : 0;
    const y = valueToY(v);
    return [
      { x: 0, y },
      { x: W, y },
    ];
  }
  return data.map((d, i) => {
    const x = (i / (n - 1)) * W;
    const v = key === "slaCompliancePercent" ? d[key] / 100 : d[key] / max;
    return { x, y: valueToY(v) };
  });
}

// One marker per real data point (unlike points(), which pads a lone
// point out to a flat line for drawing purposes).
function markerPoints(data: TrendPoint[], max: number) {
  const n = data.length;
  const valueToY = (v: number) => H - PAD_BOTTOM - v * (H - PAD_TOP - PAD_BOTTOM);
  return data.map((d, i) => {
    const x = n <= 1 ? W / 2 : (i / (n - 1)) * W;
    return { x, y: valueToY(d.volume / max) };
  });
}

function pathFrom(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function QaTrendChart({ data }: { data: TrendPoint[] }) {
  const label = summarize(data);
  if (data.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)]">Not enough data yet.</p>;
  }

  const maxVolume = Math.max(1, ...data.map((d) => d.volume));
  const volumePts = points(data, "volume", maxVolume);
  const slaPts = points(data, "slaCompliancePercent", 100);
  const markers = markerPoints(data, maxVolume);
  const volumeLine = pathFrom(volumePts);
  const slaLine = pathFrom(slaPts);
  const areaPath = `${volumeLine} L${W},${H} L0,${H} Z`;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-end gap-3 text-[10.5px]">
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
          <span className="text-[var(--muted-foreground)]">Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0 w-2.5 border-t-[1.5px] border-dashed"
            style={{ borderColor: "var(--secondary)" }}
          />
          <span className="text-[var(--muted-foreground)]">SLA %</span>
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div role="img" aria-label={label} className="absolute inset-0">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
            {[0, 0.33, 0.66, 1].map((t) => (
              <line
                key={t}
                x1={0}
                y1={H * t}
                x2={W}
                y2={H * t}
                stroke="var(--border)"
                strokeWidth={1}
              />
            ))}
            <path d={areaPath} fill="var(--accent)" opacity={0.55} />
            <path
              d={volumeLine}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={slaLine}
              fill="none"
              stroke="var(--secondary)"
              strokeWidth={1.75}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            {markers.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
            ))}
          </svg>
        </div>

        {/* Hover targets — an HTML overlay (not the SVG itself) so each
            point gets a plain-CSS group-hover tooltip without any JS
            state; positioned by percent so it tracks preserveAspectRatio
            ="none" stretching the same way the SVG does. */}
        <div className="pointer-events-none absolute inset-0">
          {data.map((d, i) => {
            const m = markers[i]!;
            return (
              <div
                key={d.month}
                className="group pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${(m.x / W) * 100}%`, top: `${(m.y / H) * 100}%` }}
              >
                <div className="h-full w-full rounded-full transition-colors duration-150 group-hover:bg-[var(--primary)]/15 group-hover:ring-2 group-hover:ring-[var(--primary)]/30" />
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-[var(--foreground)] px-2.5 py-1.5 text-[10px] whitespace-nowrap text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                >
                  <p className="qa-mono font-semibold">{d.month}</p>
                  <p>
                    Volume: <span className="qa-tabular font-semibold">{d.volume}</span>
                  </p>
                  <p>
                    SLA: <span className="qa-tabular font-semibold">{d.slaCompliancePercent}%</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1 flex justify-between">
        {data.map((d) => (
          <span key={d.month} className="qa-mono text-[10px] text-[var(--muted-foreground)]">
            {d.month}
          </span>
        ))}
      </div>

      {/* A <table> ignores an explicit tiny width/height (row/column
          layout sizes from content, not the declared box), so the
          sr-only class on the table itself doesn't actually constrain
          its rendered size — wrap it in a div instead, which does. */}
      <div className="sr-only">
        <table>
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
    </div>
  );
}
