export default function Loading() {
  return (
    <div className="workspace-page animate-pulse space-y-6" aria-label="Loading staff dashboard">
      <header className="space-y-2">
        <div className="h-3 w-32 rounded bg-[var(--muted)]" />
        <div className="h-7 w-64 rounded bg-[var(--muted)]" />
        <div className="h-4 w-72 rounded bg-[var(--muted)]" />
      </header>
      <div className="grid grid-cols-2 gap-px border-y border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-24 bg-[var(--card)]" />
        ))}
      </div>
      <div className="h-80 rounded-lg border border-[var(--border)] bg-[var(--card)]" />
    </div>
  );
}
