// src/app/admin/sla-rules/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Search, Timer } from "lucide-react";
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

const EMPTY_FORM = { categoryRef: "", priority: "medium", responseHours: 24, resolutionHours: 72 };

export default function AdminSlaRulesPage() {
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [rules, setRules] = useState<SlaRuleRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  // "new" opens the modal in create mode; a SlaRuleRow opens it pre-filled to edit that rule.
  const [editingRule, setEditingRule] = useState<SlaRuleRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const visibleRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rules;
    return rules.filter((r) =>
      [categoryName(r.categoryRef), r.priority].join(" ").toLowerCase().includes(term),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, search, categories]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setEditingRule("new");
  }

  function openEdit(rule: SlaRuleRow) {
    setForm({
      categoryRef: rule.categoryRef ?? "",
      priority: rule.priority,
      responseHours: rule.responseHours,
      resolutionHours: rule.resolutionHours,
    });
    setError(null);
    setEditingRule(rule);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      ...form,
      categoryRef: form.categoryRef || null,
      responseHours: Number(form.responseHours),
      resolutionHours: Number(form.resolutionHours),
    };

    const isEdit = editingRule && editingRule !== "new";
    const url = isEdit ? `/api/admin/sla-rules/${editingRule._id}` : "/api/admin/sla-rules";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : `Could not ${isEdit ? "update" : "create"} rule.`,
      );
      setIsSubmitting(false);
      return;
    }

    setEditingRule(null);
    setIsSubmitting(false);
    setForm(EMPTY_FORM);
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

  const isEditMode = editingRule !== null && editingRule !== "new";

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
          onClick={openCreate}
          className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Leave category blank to set an institution-wide default for a priority level.
      </p>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by category or priority…"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pr-3.5 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />
      </div>

      {isLoading ? (
        <ListRowsSkeleton />
      ) : visibleRules.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <Timer className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No SLA rules match this search.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <ul className="divide-y divide-[var(--border)]">
            {visibleRules.map((r) => (
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
                  <button
                    onClick={() => openEdit(r)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
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

      {editingRule !== null && (
        <Modal title={isEditMode ? "Edit SLA Rule" : "Add SLA Rule"} onClose={() => setEditingRule(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              {isSubmitting ? "Saving…" : isEditMode ? "Save Changes" : "Create Rule"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
