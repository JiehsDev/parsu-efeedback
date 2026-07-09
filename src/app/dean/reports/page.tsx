// src/app/dean/reports/page.tsx
import { ReportsPanel } from "@/components/reports/ReportsPanel";

export default function DeanReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Generate reports scoped to your college.
        </p>
      </div>
      <ReportsPanel showOfficeFilter />
    </div>
  );
}
