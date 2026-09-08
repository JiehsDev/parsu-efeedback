// src/components/admin/BroadcastComposer.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Megaphone } from "lucide-react";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_OPTIONS = [
  { value: "student", label: "Students" },
  { value: "office_staff", label: "Staff" },
  { value: "qa_office", label: "QA Office" },
  { value: "administrator", label: "Administrators" },
  { value: "vpaa", label: "VPAA" },
  { value: "vpaf", label: "VPAF" },
  { value: "osas", label: "OSAS" },
];

interface OfficeOption {
  _id: string;
  name: string;
}

export function BroadcastComposer() {
  const { show: showToast } = useToast();
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "role" | "office">("all");
  const [role, setRole] = useState("student");
  const [officeRef, setOfficeRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/offices")
      .then((res) => res.json())
      .then((data) => setOffices(data.offices ?? []));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = { title, body, audience };
    if (audience === "role") payload.role = role;
    if (audience === "office") payload.officeRef = officeRef;

    const res = await fetch("/api/admin/notifications/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not send announcement.");
      return;
    }

    setTitle("");
    setBody("");
    showToast(`Sent to ${data.recipientCount} user${data.recipientCount === 1 ? "" : "s"}`);
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <Megaphone className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm font-semibold text-[var(--foreground)]">Send Announcement</p>
      </div>
      <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
        Delivered as an in-app notification only — recipients are not emailed.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <FormField label="Title">
          <input
            required
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled maintenance tonight"
          />
        </FormField>

        <FormField label="Message">
          <textarea
            required
            rows={3}
            className={inputClass}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </FormField>

        <FormField label="Audience">
          <Select value={audience} onValueChange={(value) => setAudience(value as typeof audience)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All active users</SelectItem>
              <SelectItem value="role">By role</SelectItem>
              <SelectItem value="office">By office / college</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {audience === "role" && (
          <FormField label="Role">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {audience === "office" && (
          <FormField label="Office / college">
            <Select value={officeRef} onValueChange={setOfficeRef}>
              <SelectTrigger>
                <SelectValue placeholder="Select office or college" />
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
        )}

        <button
          type="submit"
          disabled={isSubmitting || (audience === "office" && !officeRef)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "Sending…" : "Send Announcement"}
        </button>
      </form>
    </div>
  );
}
