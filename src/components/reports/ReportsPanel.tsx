// src/components/reports/ReportsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Download,
  FileBarChart,
  FileClock,
  Loader2,
  Printer,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { ListRowsSkeleton } from "@/components/shared/Skeleton";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Category {
  _id: string;
  name: string;
}
interface Office {
  _id: string;
  name: string;
  type: string;
}
interface ReportRecord {
  _id: string;
  reportType: string;
  format: string;
  status: string;
  downloadUrl: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = [
  "",
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
  "resolved",
  "closed",
];

const selectClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

export function ReportsPanel({ showOfficeFilter = true }: { showOfficeFilter?: boolean }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    format: "csv" as "csv" | "excel" | "pdf",
    categoryRef: "",
    officeRef: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    slaOnly: false,
  });

  function refreshReports() {
    fetch("/api/reports/export")
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setIsLoadingReports(false));
  }

  useEffect(() => {
    refreshReports();
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
    if (showOfficeFilter) {
      fetch("/api/offices")
        .then((res) => res.json())
        .then((data) => setOffices(data.offices ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsGenerating(true);

    const payload = {
      reportType: "complaint-export",
      format: form.format,
      filters: {
        categoryRef: form.categoryRef || null,
        officeRef: form.officeRef || null,
        status: form.status || null,
        dateFrom: form.dateFrom || null,
        dateTo: form.dateTo || null,
        slaOnly: form.slaOnly,
      },
    };

    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Report generation failed.");
      setIsGenerating(false);
      return;
    }

    setIsGenerating(false);
    toast.show(`${form.format.toUpperCase()} report generated.`, "success");
    refreshReports();
  }

  async function handleDelete(report: ReportRecord) {
    const ok = await confirm({
      title: "Delete this report?",
      message: `This will permanently delete the ${report.format.toUpperCase()} ${report.reportType.replace(/-/g, " ")} report. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    setDeletingId(report._id);
    const res = await fetch(`/api/reports/${report._id}`, { method: "DELETE" });
    setDeletingId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Failed to delete report.");
      return;
    }

    setReports((prev) => prev.filter((r) => r._id !== report._id));
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleGenerate}
        className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl shadow-black/20 sm:p-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Generate Report</h2>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Format</label>
            <Select
              value={form.format}
              onValueChange={(value) => setForm((p) => ({ ...p, format: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Category</label>
            <Select
              value={form.categoryRef}
              onValueChange={(value) => setForm((p) => ({ ...p, categoryRef: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showOfficeFilter && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">Office</label>
              <Select
                value={form.officeRef}
                onValueChange={(value) => setForm((p) => ({ ...p, officeRef: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All offices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All offices</SelectItem>
                  {offices.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s ? s.replace("_", " ") : "All statuses"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">From</label>
            <input
              type="date"
              value={form.dateFrom}
              onChange={(e) => setForm((p) => ({ ...p, dateFrom: e.target.value }))}
              className={selectClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">To</label>
            <input
              type="date"
              value={form.dateTo}
              onChange={(e) => setForm((p) => ({ ...p, dateTo: e.target.value }))}
              className={selectClass}
            />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={form.slaOnly}
            onChange={(e) => setForm((p) => ({ ...p, slaOnly: e.target.checked }))}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
          />
          SLA breaches only
        </label>

        <button
          type="submit"
          disabled={isGenerating}
          className="mt-5 flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
          {isGenerating ? "Generating…" : "Generate Report"}
        </button>
      </form>

      <div>
        <div className="flex items-center gap-2.5">
          <FileClock className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Your Reports
          </h2>
        </div>

        {isLoadingReports ? (
          <div className="mt-4">
            <ListRowsSkeleton rows={3} />
          </div>
        ) : reports.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
              <FileBarChart className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              No reports generated yet.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
            <ul className="divide-y divide-[var(--border)]">
              {reports.map((r) => (
                <li
                  key={r._id}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--muted)]/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
                    <FileBarChart className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--foreground)] capitalize">
                        {r.reportType.replace(/-/g, " ")}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                        {r.format}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <ReportStatusBadge status={r.status} />
                  {r.status === "ready" && (
                    <>
                      <a
                        href={`/api/reports/${r._id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </a>
                      <a
                        href={`/api/reports/${r._id}/download`}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r._id}
                    title="Delete report"
                    aria-label="Delete report"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] disabled:opacity-50"
                  >
                    {deletingId === r._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
