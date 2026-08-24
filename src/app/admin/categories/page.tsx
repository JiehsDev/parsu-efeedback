// src/app/admin/categories/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Plus, Search, Tag } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { ListRowsSkeleton } from "@/components/shared/Skeleton";

interface CategoryRow {
  _id: string;
  name: string;
  description: string;
  defaultPriority: string;
  isActive: boolean;
}

export default function AdminCategoriesPage() {
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function refresh() {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .finally(() => setIsLoading(false));
  }

  useEffect(refresh, []);

  async function toggleActive(category: CategoryRow) {
    if (category.isActive) {
      const ok = await confirm({
        title: "Deactivate this category?",
        message: `"${category.name}" will stop appearing as a selectable category for new complaints.`,
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }

    const res = await fetch(`/api/admin/categories/${category._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !category.isActive }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error ?? "Could not update category.", "error");
      return;
    }
    showToast(category.isActive ? "Category deactivated" : "Category activated");
    refresh();
  }

  const visibleCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(term));
  }, [categories, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Tag className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Categories
          </h1>
        </div>
        <Link
          href="/admin/categories/new"
          className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Link>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          New categories are created inactive. "Add Category" walks through the routing rule and
          SLA rule it needs before it can go live.
        </span>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2.5 pr-3.5 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />
      </div>

      {isLoading ? (
        <ListRowsSkeleton />
      ) : visibleCategories.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-8 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
            <Tag className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
            No categories match this search.
          </p>
        </div>
      ) : (
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <ul className="divide-y divide-[var(--border)]">
          {visibleCategories.map((c) => (
            <li
              key={c._id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <Link
                href={`/admin/categories/${c._id}`}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl transition-colors hover:bg-[var(--muted)]/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    {c.name}
                  </span>
                  <span className="mt-0.5 block text-xs capitalize text-[var(--muted-foreground)]">
                    {c.defaultPriority} priority
                  </span>
                </span>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
              </Link>
              <div className="flex items-center gap-2 sm:shrink-0">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.isActive
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {c.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => toggleActive(c)}
                  className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                >
                  {c.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      )}

      <p className="text-sm text-[var(--muted-foreground)]">
        Each category's routing rule is managed from its own page. Institution-wide SLA defaults
        live in{" "}
        <Link href="/admin/sla-rules" className="text-[var(--primary)] hover:underline">
          SLA Rules
        </Link>
        .
      </p>
    </div>
  );
}
