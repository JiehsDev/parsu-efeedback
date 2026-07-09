// src/components/reports/ReportsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { ReportStatusBadge } from "./ReportStatusBadge";

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

export function ReportsPanel({
  showOfficeFilter = true,
  showCollegeFilter = false,
}: {
  showOfficeFilter?: boolean;
  showCollegeFilter?: boolean;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .then((data) => setReports(data.reports ?? []));
  }

  useEffect(() => {
    refreshReports();
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
    if (showOfficeFilter) {
      fetch("/api/offices")
        .then((res) => res.json())
        .then((data) =>
          setOffices((data.offices ?? []).filter((o: Office) => o.type === "service_office")),
        );
    }
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
    refreshReports();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleGenerate}
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Generate Report</h2>
        {error && (
          <p className="mt-2 rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Format</label>
            <select
              value={form.format}
              onChange={(e) => setForm((p) => ({ ...p, format: e.target.value as any }))}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Category</label>
            <select
              value={form.categoryRef}
              onChange={(e) => setForm((p) => ({ ...p, categoryRef: e.target.value }))}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {showOfficeFilter && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">Office</label>
              <select
                value={form.officeRef}
                onChange={(e) => setForm((p) => ({ ...p, officeRef: e.target.value }))}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
              >
                <option value="">All offices</option>
                {offices.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s ? s.replace("_", " ") : "All statuses"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">From</label>
            <input
              type="date"
              value={form.dateFrom}
              onChange={(e) => setForm((p) => ({ ...p, dateFrom: e.target.value }))}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">To</label>
            <input
              type="date"
              value={form.dateTo}
              onChange={(e) => setForm((p) => ({ ...p, dateTo: e.target.value }))}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={form.slaOnly}
            onChange={(e) => setForm((p) => ({ ...p, slaOnly: e.target.checked }))}
            className="rounded border-[var(--border)]"
          />
          SLA breaches only
        </label>

        <button
          type="submit"
          disabled={isGenerating}
          className="mt-4 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {isGenerating ? "Generating…" : "Generate Report"}
        </button>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Your Reports</h2>
        <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Format</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Generated</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted-foreground)]">
                    No reports generated yet.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r._id} className="bg-[var(--card)]">
                    <td className="px-4 py-3 text-[var(--foreground)]">{r.reportType}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] uppercase">
                      {r.format}
                    </td>
                    <td className="px-4 py-3">
                      <ReportStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "ready" && (
                        <a
                          href={`/api/reports/${r._id}/download`}
                          className="text-xs font-medium text-[var(--primary)] hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
