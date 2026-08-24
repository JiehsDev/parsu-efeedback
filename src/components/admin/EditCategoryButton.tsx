// src/components/admin/EditCategoryButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";

interface EditableCategory {
  _id: string;
  name: string;
  description: string;
}

export function EditCategoryButton({ category }: { category: EditableCategory }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: category.name,
    description: category.description,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/admin/categories/${category._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update category.");
      return;
    }

    setIsOpen(false);
    showToast("Category updated");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit Category
      </button>

      {isOpen && (
        <Modal title="Edit Category" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <FormField label="Description">
              <textarea
                rows={2}
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>

            <p className="text-xs text-[var(--muted-foreground)]">
              Office and priority are set from this category&apos;s routing and SLA rules, not
              here — edit them from the Configuration Status panel below.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
