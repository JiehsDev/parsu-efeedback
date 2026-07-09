// src/app/admin/categories/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";

interface CategoryRow {
  _id: string;
  name: string;
  description: string;
  defaultPriority: string;
  isActive: boolean;
}

interface Office {
  _id: string;
  name: string;
}

const PRIORITIES = ["low", "medium", "high", "critical"];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    defaultOfficeRef: "",
    defaultPriority: "medium",
  });

  function refresh() {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }

  useEffect(() => {
    refresh();
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create category.");
      setIsSubmitting(false);
      return;
    }

    setShowCreate(false);
    setIsSubmitting(false);
    setForm({ name: "", description: "", defaultOfficeRef: "", defaultPriority: "medium" });
    refresh();
  }

  async function toggleActive(category: CategoryRow) {
    setActivateError((prev) => ({ ...prev, [category._id]: "" }));

    const res = await fetch(`/api/admin/categories/${category._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !category.isActive }),
    });
    const data = await res.json();

    if (!res.ok) {
      setActivateError((prev) => ({ ...prev, [category._id]: data.error ?? "Could not update." }));
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Categories</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          + Add Category
        </button>
      </div>

      <p className="rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
        New categories are created inactive. Add a routing rule and an SLA rule before activating,
        or activation will be blocked.
      </p>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {categories.map((c) => (
              <tr key={c._id} className="bg-[var(--card)]">
                <td className="px-4 py-3 text-[var(--foreground)]">{c.name}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] capitalize">
                  {c.defaultPriority}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                  {activateError[c._id] && (
                    <p className="mt-1 text-xs text-[var(--destructive)]">{activateError[c._id]}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(c)}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {c.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Configure routing in{" "}
        <Link href="/admin/routing-rules" className="text-[var(--primary)] hover:underline">
          Routing Rules
        </Link>{" "}
        and SLA timing in{" "}
        <Link href="/admin/sla-rules" className="text-[var(--primary)] hover:underline">
          SLA Rules
        </Link>
        .
      </p>

      {showCreate && (
        <Modal title="Add Category" onClose={() => setShowCreate(false)}>
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

            <FormField label="Description">
              <textarea
                rows={2}
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>

            <FormField label="Default office">
              <select
                required
                className={inputClass}
                value={form.defaultOfficeRef}
                onChange={(e) => setForm((p) => ({ ...p, defaultOfficeRef: e.target.value }))}
              >
                <option value="" disabled>
                  Select office
                </option>
                {offices.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Default priority">
              <select
                className={inputClass}
                value={form.defaultPriority}
                onChange={(e) => setForm((p) => ({ ...p, defaultPriority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create Category"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
