// src/app/student/complaints/new/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Category {
  _id: string;
  name: string;
  description: string;
  defaultPriority: string;
}

export default function NewComplaintPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ categoryRef: "", title: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  const selectedCategory = categories.find((c) => c._id === form.categoryRef);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Could not submit complaint.");
        setIsSubmitting(false);
        return;
      }

      router.push(`/student/complaints?submitted=${data.complaint.ticketNumber}`);
    } catch {
      setError("An unexpected system error occurred.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/student/dashboard"
        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">Submit a Complaint</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Describe the issue clearly — this helps route it to the right office faster.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="categoryRef" className="text-sm font-medium text-[var(--foreground)]">
            Category
          </label>
          <select
            id="categoryRef"
            required
            value={form.categoryRef}
            onChange={(e) => setForm((prev) => ({ ...prev, categoryRef: e.target.value }))}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          {selectedCategory?.description && (
            <p className="text-xs text-[var(--muted-foreground)]">{selectedCategory.description}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium text-[var(--foreground)]">
            Title
          </label>
          <input
            id="title"
            required
            minLength={5}
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Brief summary of the issue"
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-medium text-[var(--foreground)]">
            Description
          </label>
          <textarea
            id="description"
            required
            minLength={20}
            rows={6}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Explain what happened, when, and any relevant details."
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          <p className="text-xs text-[var(--muted-foreground)]">Minimum 20 characters.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Submitting…" : "Submit Complaint"}
        </button>
      </form>
    </div>
  );
}
