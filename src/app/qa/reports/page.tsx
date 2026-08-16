// src/app/qa/reports/page.tsx
import { FileBarChart } from "lucide-react";
import { ReportsPanel } from "@/components/reports/ReportsPanel";

export default function QaReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <FileBarChart className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Reports</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Generate institution-wide complaint reports.
          </p>
        </div>
      </div>
      <ReportsPanel showOfficeFilter />
    </div>
  );
}
