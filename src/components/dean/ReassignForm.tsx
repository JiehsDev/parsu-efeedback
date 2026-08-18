// src/components/dean/ReassignForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRightLeft, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { show: showToast } = useToast();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    showToast("Complaint reassigned");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
          <ArrowRightLeft className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm font-semibold text-[var(--foreground)]">Reassign / Escalate</p>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Office</label>
          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select an office" />
            </SelectTrigger>
            <SelectContent>
              {offices.map((o) => (
                <SelectItem key={o._id} value={o._id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Staff (optional)</label>
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="— Unassigned —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Unassigned —</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.firstName} {s.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <MessageSquare className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--muted-foreground)]" />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Reason for reassignment (optional)"
            rows={2}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pr-3 pl-10 text-sm text-[var(--foreground)] transition-colors outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Reassigning…" : "Reassign"}
        </button>
      </div>
    </form>
  );
}
