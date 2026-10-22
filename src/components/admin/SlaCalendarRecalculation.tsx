"use client";

import { clientFetch } from "@/lib/client-fetch";

import { useState } from "react";
import { SLA_TIME_ZONE } from "@/lib/sla-calendar";

type Preview = {
  token: string;
  count: number;
  skipped: number;
  sample: Array<{
    id: string;
    ticketNumber: string;
    previous: { responseDue?: string | null; resolutionDue?: string | null };
    slaResponseDueAt: string;
    slaResolutionDueAt: string;
  }>;
};

function dateLabel(date?: string | null) {
  return date ? new Date(date).toLocaleString("en-PH", { timeZone: SLA_TIME_ZONE }) : "Not set";
}

export function SlaCalendarRecalculation({ calendarDirty = false }: { calendarDirty?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(apply: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await clientFetch(
        "/api/admin/sla-calendar/recalculate",
        apply
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: preview?.token }),
            }
          : { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not recalculate SLA dates.",
        );
      if (apply) {
        setMessage(`Updated ${data.updated} unresolved complaints; skipped ${data.skipped}.`);
        setPreview(null);
      } else setPreview(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not recalculate SLA dates.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Update existing unresolved complaints
      </h2>
      <p className="text-xs text-[var(--muted-foreground)]">
        Save calendar changes first, then preview new deadlines using the current SLA rules and
        holidays. Completed and archived complaints keep their existing results. Applying resets SLA
        warning flags; assignment and escalation history remain recorded.
      </p>
      <button
        type="button"
        disabled={busy || calendarDirty}
        onClick={() => run(false)}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
      >
        {busy ? "Processing…" : "Preview new deadlines"}
      </button>
      {calendarDirty && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Save holiday changes before previewing or applying new deadlines.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-[var(--foreground)]">
          {message}
        </p>
      )}
      {preview && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--foreground)]">
            {preview.count} complaints to update; {preview.skipped} missing an SLA rule. First 20
            shown. Philippine time.
          </p>
          <div className="max-h-80 overflow-auto">
            {preview.sample.map((row) => (
              <div
                key={row.id}
                className="border-b border-[var(--border)] py-3 text-xs text-[var(--muted-foreground)]"
              >
                <p className="font-medium text-[var(--foreground)]">{row.ticketNumber}</p>
                <p>
                  Response: {dateLabel(row.previous.responseDue)} →{" "}
                  {dateLabel(row.slaResponseDueAt)}
                </p>
                <p>
                  Resolution: {dateLabel(row.previous.resolutionDue)} →{" "}
                  {dateLabel(row.slaResolutionDueAt)}
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || calendarDirty || preview.count === 0}
            onClick={() => run(true)}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
          >
            Apply to {preview.count} unresolved complaints
          </button>
        </div>
      )}
    </section>
  );
}
