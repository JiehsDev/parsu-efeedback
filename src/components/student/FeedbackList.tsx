"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { FEEDBACK_CATEGORIES } from "@/features/feedback/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";

interface FeedbackItem {
  _id: string;
  category: string;
  message: string;
  isAnonymous: boolean;
  createdAt: string;
}

export function FeedbackList({ feedback }: { feedback: FeedbackItem[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { show: showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ category: "", message: "", isAnonymous: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function beginEdit(item: FeedbackItem) {
    setEditingId(item._id);
    setDraft({
      category: item.category,
      message: item.message,
      isAnonymous: item.isAnonymous,
    });
    setError(null);
  }

  async function save(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not update feedback.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function archive(id: string) {
    const ok = await confirm({
      title: "Archive feedback?",
      message: "This feedback will be hidden from your active list.",
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;

    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not archive feedback.");
      showToast("Could not archive feedback.", "error");
      return;
    }
    showToast("Feedback archived");
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
        Feedback you&rsquo;ve sent
      </h2>
      {error && <p className="border-b border-[var(--border)] px-4 py-2 text-sm text-[var(--destructive)]">{error}</p>}
      <ul className="divide-y divide-[var(--border)]">
        {feedback.map((item) => {
          const isEditing = editingId === item._id;
          return (
            <li key={item._id} className="px-4 py-3">
              {isEditing ? (
                <div className="space-y-3">
                  <Select
                    value={draft.category}
                    onValueChange={(category) => setDraft((prev) => ({ ...prev, category }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <textarea
                    rows={4}
                    value={draft.message}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, message: event.target.value }))
                    }
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={draft.isAnonymous}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            isAnonymous: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      Anonymous
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        aria-label="Cancel edit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => save(item._id)}
                        disabled={busyId === item._id}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-50"
                        aria-label="Save feedback"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span className="font-medium text-[var(--foreground)]">{item.category}</span>
                    {item.isAnonymous && (
                      <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[11px]">
                        Anonymous
                      </span>
                    )}
                    <RelativeTime date={item.createdAt} className="qa-tabular ml-auto shrink-0" />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {item.message}
                  </p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => beginEdit(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                      aria-label="Edit feedback"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => archive(item._id)}
                      disabled={busyId === item._id}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] disabled:opacity-50"
                      aria-label="Archive feedback"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
