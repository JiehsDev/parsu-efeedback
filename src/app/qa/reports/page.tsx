// src/app/qa/reports/page.tsx
import { ReportsPanel } from "@/components/reports/ReportsPanel";

export default function QaReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Generate institution-wide complaint reports.
        </p>
      </div>
      <ReportsPanel showOfficeFilter showCollegeFilter={false} />
    </div>
  );
}
