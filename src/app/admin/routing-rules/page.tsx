// src/app/admin/routing-rules/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";

interface RuleRow {
  _id: string;
  categoryRef: string;
  targetOfficeRef: string;
  isActive: boolean;
}

interface Category {
  _id: string;
  name: string;
}

interface Office {
  _id: string;
  name: string;
}

export default function AdminRoutingRulesPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ categoryRef: "", targetOfficeRef: "" });

  function refresh() {
    fetch("/api/admin/routing-rules")
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []));
  }

  useEffect(() => {
    refresh();
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
  }, []);

  function categoryName(id: string) {
    return categories.find((c) => c._id === id)?.name ?? id;
  }
  function officeName(id: string) {
    return offices.find((o) => o._id === id)?.name ?? id;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/admin/routing-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create rule.");
      setIsSubmitting(false);
      return;
    }

    setShowCreate(false);
    setIsSubmitting(false);
    setForm({ categoryRef: "", targetOfficeRef: "" });
    refresh();
  }

  async function deactivate(rule: RuleRow) {
    await fetch(`/api/admin/routing-rules/${rule._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Routing Rules</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          + Add Rule
        </button>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Each category can have at most one active routing rule. Deactivating clears the way to add a
        replacement.
      </p>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Target Office</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rules.map((r) => (
              <tr key={r._id} className="bg-[var(--card)]">
                <td className="px-4 py-3 text-[var(--foreground)]">
                  {categoryName(r.categoryRef)}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">
                  {officeName(r.targetOfficeRef)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.isActive && (
                    <button
                      onClick={() => deactivate(r)}
                      className="text-xs font-medium text-[var(--destructive)] hover:underline"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Add Routing Rule" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

            <FormField label="Category">
              <select
                required
                className={inputClass}
                value={form.categoryRef}
                onChange={(e) => setForm((p) => ({ ...p, categoryRef: e.target.value }))}
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Target office">
              <select
                required
                className={inputClass}
                value={form.targetOfficeRef}
                onChange={(e) => setForm((p) => ({ ...p, targetOfficeRef: e.target.value }))}
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create Rule"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
