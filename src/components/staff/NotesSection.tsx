// src/components/staff/NotesSection.tsx
"use client";

import { useState } from "react";

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
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm font-medium text-[var(--foreground)]">Internal Notes</p>
      <p className="text-xs text-[var(--muted-foreground)]">Never visible to the student.</p>

      <div className="mt-3 space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">No notes yet.</p>
        )}
        {notes.map((note) => (
          <div key={note._id} className="rounded-[var(--radius)] bg-[var(--muted)]/50 p-3">
            <p className="text-sm text-[var(--foreground)]">{note.body}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {new Date(note.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3">
        {error && <p className="mb-2 text-sm text-[var(--destructive)]">{error}</p>}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an internal note…"
          rows={2}
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />
        <button
          type="submit"
          disabled={isSubmitting || !body.trim()}
          className="mt-2 rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {isSubmitting ? "Adding…" : "Add Note"}
        </button>
      </form>
    </div>
  );
}
