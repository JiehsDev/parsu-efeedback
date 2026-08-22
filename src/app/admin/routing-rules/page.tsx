// src/app/admin/routing-rules/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Route, Search } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { ListRowsSkeleton } from "@/components/shared/Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const EMPTY_FORM = { categoryRef: "", targetOfficeRef: "" };

export default function AdminRoutingRulesPage() {
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [search, setSearch] = useState("");
  // "new" opens the modal in create mode; a RuleRow opens it pre-filled to edit that rule.
  const [editingRule, setEditingRule] = useState<RuleRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);

  function refresh() {
    fetch("/api/admin/routing-rules")
      .then((res) => res.json())
      .then((data) => setRules(data.rules ?? []))
      .finally(() => setIsLoading(false));
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

  const visibleRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rules;
    return rules.filter((r) =>
      [categoryName(r.categoryRef), officeName(r.targetOfficeRef)]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, search, categories, offices]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setEditingRule("new");
  }

  function openEdit(rule: RuleRow) {
    setForm({ categoryRef: rule.categoryRef, targetOfficeRef: rule.targetOfficeRef });
    setError(null);
    setEditingRule(rule);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const isEdit = editingRule && editingRule !== "new";
    const url = isEdit ? `/api/admin/routing-rules/${editingRule._id}` : "/api/admin/routing-rules";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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

  async function deactivate(rule: RuleRow) {
    const ok = await confirm({
      title: "Deactivate this routing rule?",
      message: `New complaints under "${categoryName(rule.categoryRef)}" will have nowhere to route until a replacement rule is added.`,
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/admin/routing-rules/${rule._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not deactivate rule.", "error");
      return;
    }
    showToast("Routing rule deactivated");
    refresh();
  }

  const isEditMode = editingRule !== null && editingRule !== "new";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Route className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Routing Rules
          </h1>
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
        Each category can have at most one active routing rule. Deactivating clears the way to add
        a replacement.
      </p>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by category or office…"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pr-3.5 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />
      </div>

      {isLoading ? (
        <ListRowsSkeleton />
      ) : visibleRules.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <Route className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No routing rules match this search.
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
                <span className="block text-sm font-medium text-[var(--foreground)]">
                  {categoryName(r.categoryRef)}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                  → {officeName(r.targetOfficeRef)}
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
        <Modal title={isEditMode ? "Edit Routing Rule" : "Add Routing Rule"} onClose={() => setEditingRule(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormField label="Category">
              <Select
                value={form.categoryRef}
                onValueChange={(value) => setForm((p) => ({ ...p, categoryRef: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Target office">
              <Select
                value={form.targetOfficeRef}
                onValueChange={(value) => setForm((p) => ({ ...p, targetOfficeRef: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

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
