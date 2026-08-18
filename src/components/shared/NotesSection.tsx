// src/components/staff/NotesSection.tsx
"use client";

import { useState } from "react";
import { AlertCircle, Lock, Loader2, NotebookPen, Send } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

interface Note {
  _id: string;
  body: string;
  authorRef: string;
  createdAt: string;
}

export function NotesSection({
  complaintId,
  initialNotes,
}: {
  complaintId: string;
  initialNotes: Note[];
}) {
  const { show: showToast } = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/complaints/${complaintId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not add note.");
      setIsSubmitting(false);
      return;
    }

    setNotes((prev) => [...prev, data.note]);
    setBody("");
    setIsSubmitting(false);
    showToast("Note added");
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
          <NotebookPen className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Internal Notes</p>
          <p className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <Lock className="h-3 w-3" />
            Never visible to the student
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {notes.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">No notes yet.</p>
        )}
        {notes.map((note) => (
          <div key={note._id} className="rounded-2xl bg-[var(--muted)]/50 px-4 py-3">
            <p className="text-sm text-[var(--foreground)]">{note.body}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {new Date(note.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an internal note…"
          rows={2}
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />
        <button
          type="submit"
          disabled={isSubmitting || !body.trim()}
          className="mt-2.5 flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isSubmitting ? "Adding…" : "Add Note"}
        </button>
      </form>
    </div>
  );
}
