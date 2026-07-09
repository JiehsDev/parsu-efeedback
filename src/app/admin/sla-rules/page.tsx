// src/app/admin/sla-rules/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";

interface SlaRuleRow {
  _id: string;
  categoryRef: string | null;
  priority: string;
  responseHours: number;
  resolutionHours: number;
  isActive: boolean;
}

interface Category {
  _id: string;
  name: string;
}

const PRIORITIES = ["low", "medium", "high", "critical"];

export default function AdminSlaRulesPage() {
  const [rules, setRules] = useState<SlaRuleRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    categoryRef: "",
    priority: "medium",
    responseHours: 24,
    resolutionHours: 72,
  });

  function refresh() {
    fetch("/api/admin/sla-rules")
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []));
  }

  useEffect(() => {
    refresh();
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  function categoryName(id: string | null) {
    if (!id) return "Institution-wide default";
    return categories.find((c) => c._id === id)?.name ?? id;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      ...form,
      categoryRef: form.categoryRef || null,
      responseHours: Number(form.responseHours),
      resolutionHours: Number(form.resolutionHours),
    };

    const res = await fetch("/api/admin/sla-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create rule.");
      setIsSubmitting(false);
      return;
    }

    setShowCreate(false);
    setIsSubmitting(false);
    setForm({ categoryRef: "", priority: "medium", responseHours: 24, resolutionHours: 72 });
    refresh();
  }

  async function deactivate(rule: SlaRuleRow) {
    await fetch(`/api/admin/sla-rules/${rule._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">SLA Rules</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          + Add Rule
        </button>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Leave category blank to set an institution-wide default for a priority level.
      </p>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Response</th>
              <th className="px-4 py-2 font-medium">Resolution</th>
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
                <td className="px-4 py-3 text-[var(--muted-foreground)] capitalize">
                  {r.priority}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{r.responseHours}h</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{r.resolutionHours}h</td>
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
        <Modal title="Add SLA Rule" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

            <FormField label="Category" hint="Leave blank for institution-wide default">
              <select
                className={inputClass}
                value={form.categoryRef}
                onChange={(e) => setForm((p) => ({ ...p, categoryRef: e.target.value }))}
              >
                <option value="">— Institution-wide —</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Priority">
              <select
                className={inputClass}
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Response hours">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={form.responseHours}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, responseHours: Number(e.target.value) }))
                  }
                />
              </FormField>
              <FormField label="Resolution hours">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={form.resolutionHours}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, resolutionHours: Number(e.target.value) }))
                  }
                />
              </FormField>
            </div>

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
