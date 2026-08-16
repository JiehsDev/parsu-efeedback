// src/app/admin/offices/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Building2, ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { ListRowsSkeleton } from "@/components/shared/Skeleton";

interface OfficeRow {
  _id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
}

export default function AdminOfficesPage() {
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [offices, setOffices] = useState<OfficeRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: "", code: "", type: "service_office" });

  function refresh() {
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []))
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/admin/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create office.");
      setIsSubmitting(false);
      return;
    }

    setShowCreate(false);
    setIsSubmitting(false);
    setForm({ name: "", code: "", type: "service_office" });
    refresh();
  }

  async function toggleActive(office: OfficeRow) {
    if (office.isActive) {
      const ok = await confirm({
        title: "Deactivate this office?",
        message: `"${office.name}" will stop being assignable to new complaints or staff.`,
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }

    const res = await fetch(`/api/admin/offices/${office._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !office.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not update office.", "error");
      return;
    }
    showToast(office.isActive ? "Office deactivated" : "Office activated");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Building2 className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Offices</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Office
        </button>
      </div>

      {isLoading ? (
        <ListRowsSkeleton />
      ) : (
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <ul className="divide-y divide-[var(--border)]">
          {offices.map((o) => (
            <li
              key={o._id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <Link
                href={`/admin/offices/${o._id}`}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl transition-colors hover:bg-[var(--muted)]/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">{o.name}</span>
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">
                      {o.code}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs capitalize text-[var(--muted-foreground)]">
                    {o.type.replace("_", " ")}
                  </span>
                </span>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
              </Link>
              <div className="flex items-center gap-2 sm:shrink-0">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    o.isActive
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {o.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => toggleActive(o)}
                  className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                >
                  {o.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      )}

      {showCreate && (
        <Modal title="Add Office" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormField label="Name">
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>

            <FormField label="Code" hint="Short unique code, e.g. CCIS, OUR">
              <input
                required
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
            </FormField>

            <FormField label="Type">
              <div className="relative">
                <select
                  className={`${inputClass} appearance-none pr-9`}
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="service_office">Service Office</option>
                  <option value="college">College</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating…" : "Create Office"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
