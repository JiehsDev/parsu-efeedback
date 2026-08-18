// src/app/admin/sla-rules/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Timer } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { ListRowsSkeleton } from "@/components/shared/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [rules, setRules] = useState<SlaRuleRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({
    categoryRef: "",
    priority: "medium",
    responseHours: 24,
    resolutionHours: 72,
  });

  function refresh() {
    fetch("/api/admin/sla-rules")
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []))
      .finally(() => setIsLoading(false));
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
    const ok = await confirm({
      title: "Deactivate this SLA rule?",
      message: `"${categoryName(rule.categoryRef)}" (${rule.priority}) will no longer set deadlines for new complaints until a replacement rule is added.`,
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/admin/sla-rules/${rule._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not deactivate rule.", "error");
      return;
    }
    showToast("SLA rule deactivated");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Timer className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">SLA Rules</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Leave category blank to set an institution-wide default for a priority level.
      </p>

      {isLoading ? (
        <ListRowsSkeleton />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {rules.map((r) => (
              <li
                key={r._id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {categoryName(r.categoryRef)}
                    </span>
                    <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                      {r.priority}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    Response {r.responseHours}h · Resolution {r.resolutionHours}h
                  </span>
                </span>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                  {r.isActive && (
                    <button
                      onClick={() => deactivate(r)}
                      className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCreate && (
        <Modal title="Add SLA Rule" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormField label="Category" hint="Leave blank for institution-wide default">
              <Select
                value={form.categoryRef}
                onValueChange={(value) => setForm((p) => ({ ...p, categoryRef: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Institution-wide —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Institution-wide —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Priority">
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((p) => ({ ...p, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating…" : "Create Rule"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
