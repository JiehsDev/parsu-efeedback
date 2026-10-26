import { ReportsPanel } from "@/components/reports/ReportsPanel";
export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Export complaint records and response statistics.
        </p>
      </header>
      <ReportsPanel showOfficeFilter={false} />
    </div>
  );
}
