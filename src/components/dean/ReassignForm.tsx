// src/components/dean/ReassignForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Office {
  _id: string;
  name: string;
  type: string;
}

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
}

export function ReassignForm({
  complaintId,
  currentOfficeRef,
}: {
  complaintId: string;
  currentOfficeRef: string;
}) {
  const router = useRouter();
  const [offices, setOffices] = useState<Office[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedOffice, setSelectedOffice] = useState(currentOfficeRef);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offices")
      .then((res) => res.json())
      .then((data) =>
        setOffices((data.offices ?? []).filter((o: Office) => o.type === "service_office")),
      );
  }, []);

  useEffect(() => {
    if (!selectedOffice) return;
    fetch(`/api/offices/${selectedOffice}/staff`)
      .then((res) => res.json())
      .then((data) => setStaff(data.staff ?? []));
    setSelectedStaff("");
  }, [selectedOffice]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = { message };
    if (selectedOffice !== currentOfficeRef) payload.assignedOfficeRef = selectedOffice;
    if (selectedStaff) payload.assignedStaffRef = selectedStaff;

    const res = await fetch(`/api/complaints/${complaintId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not reassign complaint.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setMessage("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <p className="text-sm font-medium text-[var(--foreground)]">Reassign / Escalate</p>
      {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Office</label>
          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          >
            {offices.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Staff (optional)</label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          >
            <option value="">— Unassigned —</option>
            {staff.map((s) => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Reason for reassignment (optional)"
          rows={2}
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Reassigning…" : "Reassign"}
        </button>
      </div>
    </form>
  );
}
