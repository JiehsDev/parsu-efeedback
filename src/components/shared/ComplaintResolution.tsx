export function ComplaintResolution({
  summary,
  status,
  resolvedAt,
  resolverName,
}: {
  summary?: string | null;
  status: string;
  resolvedAt?: Date | string | null;
  resolverName?: string;
}) {
  const isResolved = status === "resolved" || status === "closed";
  if (!isResolved && !summary && !resolvedAt) return null;

  return (
    <section
      aria-labelledby="resolution-details-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <h2
        id="resolution-details-heading"
        className="text-sm font-semibold text-[var(--foreground)]"
      >
        {isResolved ? "Resolution details" : "Previous resolution details"}
      </h2>
      {!isResolved && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          This complaint is no longer resolved. These details describe the previous resolution.
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--foreground)]">
        {summary?.trim() || "No resolution details recorded."}
      </p>
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Resolved by {resolverName || "Not recorded"}
        {resolvedAt ? ` · ${new Date(resolvedAt).toLocaleString()}` : ""}
      </p>
    </section>
  );
}
