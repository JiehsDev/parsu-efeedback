// src/components/qa/charts/QaBarList.tsx
export interface QaBarPoint {
  label: string;
  value: number;
}

function summarize(data: QaBarPoint[], subject: string): string {
  if (data.length === 0) return `No ${subject} data available.`;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const top = data.reduce((max, d) => (d.value > max.value ? d : max), data[0]!);
  return (
    `Bar chart of complaint volume by ${subject}, ${data.length} entries, ` +
    `${total} complaints total. Largest: ${top.label} with ${top.value}. ` +
    `Full breakdown follows in the adjacent table.`
  );
}

export function QaBarList({
  data,
  subject,
  color = "var(--primary)",
}: {
  data: QaBarPoint[];
  subject: string;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const label = summarize(data, subject);

  return (
    <div>
      <div role="img" aria-label={label} className="flex flex-col justify-center gap-2 py-1">
        {data.map((d) => (
          <div key={d.label} className="group relative flex items-center gap-2">
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-[var(--foreground)] px-2 py-1 text-[10px] font-medium whitespace-nowrap text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
            >
              {d.label}: <span className="qa-tabular font-semibold">{d.value}</span>
            </div>
            <span className="w-[76px] shrink-0 truncate text-[10.5px] text-[var(--muted-foreground)]">
              {d.label}
            </span>
            <span className="h-[7px] flex-1 cursor-pointer overflow-hidden rounded-full bg-[var(--muted)]">
              <span
                className="block h-full rounded-full transition-[filter] duration-150 group-hover:brightness-110"
                style={{ width: `${(d.value / max) * 100}%`, background: color }}
              />
            </span>
            <span className="qa-tabular w-6 shrink-0 text-right text-[10.5px] font-semibold text-[var(--foreground)]">
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
