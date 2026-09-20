// src/app/admin/audit-logs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search } from "lucide-react";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { actionLabel } from "@/lib/display-labels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLogRow {
  _id: string;
  actorRef: { firstName: string; lastName: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

const ENTITY_TYPES = ["", "User", "Office", "Category", "RoutingRule", "SLARule", "Complaint"];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (entityType) params.set("entityType", entityType);
    if (actionFilter) params.set("action", actionFilter);
    if (actorFilter) params.set("actor", actorFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/admin/audit-logs?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load audit logs.");
        return data;
      })
      .then((data) => {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load audit logs."))
      .finally(() => setIsLoading(false));
  }, [page, entityType, actionFilter, actorFilter, dateFrom, dateTo, retryKey]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <ScrollText className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Audit Logs</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Select
          value={entityType}
          onValueChange={(value) => {
            setEntityType(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto bg-[var(--card)]">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t || "All entity types"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            placeholder="Filter by action (e.g. user.create)"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pr-3.5 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            placeholder="Filter by actor name or email"
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pr-3.5 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          <span className="text-sm text-[var(--muted-foreground)]">to</span>
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : error ? (
        <div className="rounded-3xl border border-[var(--destructive)]/35 bg-[var(--destructive)]/10 p-6 text-center text-sm text-[var(--destructive)]">
          <AlertCircle className="mx-auto h-5 w-5" />
          <p className="mt-2">{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <ScrollText className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No matching audit log entries.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
            <ul className="divide-y divide-[var(--border)]">
              {logs.map((log) => (
                <li key={log._id}>
                  <Link
                    href={`/admin/audit-logs/${log._id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--muted)]/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                          {actionLabel(log.action)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                        {log.actorRef
                          ? `${log.actorRef.firstName} ${log.actorRef.lastName}`
                          : "System"}
                        {" · "}
                        {log.entityType} <span className="font-mono">{log.entityId}</span>
                      </span>
                    </span>
                    <RelativeTime
                      date={log.createdAt}
                      className="shrink-0 text-xs text-[var(--muted-foreground)]"
                    />
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
