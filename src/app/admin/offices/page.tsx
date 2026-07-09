// src/app/admin/offices/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";

interface OfficeRow {
  _id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
}

export default function AdminOfficesPage() {
  const [offices, setOffices] = useState<OfficeRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", type: "service_office" });

  function refresh() {
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
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
    await fetch(`/api/admin/offices/${office._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !office.isActive }),
    });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Offices</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          + Add Office
        </button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {offices.map((o) => (
              <tr key={o._id} className="bg-[var(--card)]">
                <td className="px-4 py-3 text-[var(--foreground)]">{o.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                  {o.code}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] capitalize">
                  {o.type.replace("_", " ")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {o.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(o)}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {o.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Add Office" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

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
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="service_office">Service Office</option>
                <option value="college">College</option>
              </select>
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create Office"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
