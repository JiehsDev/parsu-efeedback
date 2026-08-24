// src/components/admin/EditSlaRuleButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_SLA_HOURS, type PriorityLevel } from "@/lib/constants";

const PRIORITIES = ["low", "medium", "high", "critical"];

interface OfficeOption {
  _id: string;
  name: string;
}

export function EditSlaRuleButton({
  categoryId,
  currentPriority,
  rule,
  offices,
}: {
  categoryId: string;
  currentPriority: string;
  rule: {
    _id: string;
    responseHours: number;
    resolutionHours: number;
    escalateToOfficeRef: string | null;
  } | null;
  offices: OfficeOption[];
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [priority, setPriority] = useState(currentPriority);
  const [responseHours, setResponseHours] = useState(rule?.responseHours ?? 24);
  const [resolutionHours, setResolutionHours] = useState(rule?.resolutionHours ?? 72);
  const [escalateToOfficeRef, setEscalateToOfficeRef] = useState(rule?.escalateToOfficeRef ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // This is the one place a category's priority actually gets set — the
    // server cascades it onto Category.defaultPriority (see
    // src/app/api/admin/sla-rules/route.ts), since a category's priority
    // only ever matters as "which SLA clock applies."
    const url = rule ? `/api/admin/sla-rules/${rule._id}` : "/api/admin/sla-rules";
    const res = await fetch(url, {
      method: rule ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryRef: categoryId,
        priority,
        responseHours: Number(responseHours),
        resolutionHours: Number(resolutionHours),
        escalateToOfficeRef: escalateToOfficeRef || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save SLA rule.");
      return;
    }

    setIsOpen(false);
    showToast(rule ? "SLA rule updated" : "SLA rule created");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
      >
        {rule ? (
          <>
            <Pencil className="h-3 w-3" />
            Edit
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" />
            Add SLA rule
          </>
        )}
      </button>

      {isOpen && (
        <Modal title={rule ? "Edit SLA Rule" : "Add SLA Rule"} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormField
              label="Priority"
              hint="Every complaint filed under this category gets this priority — this is where it's set"
            >
              <Select
                value={priority}
                onValueChange={(value) => {
                  setPriority(value);
                  const preset = DEFAULT_SLA_HOURS[value as PriorityLevel];
                  setResponseHours(preset.responseHours);
                  setResolutionHours(preset.resolutionHours);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Response hours">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={responseHours}
                  onChange={(e) => setResponseHours(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Resolution hours">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={resolutionHours}
                  onChange={(e) => setResolutionHours(Number(e.target.value))}
                />
              </FormField>
            </div>

            <FormField
              label="Escalate to office"
              hint="If the resolution deadline is breached, the complaint is reassigned here automatically"
            >
              <Select value={escalateToOfficeRef} onValueChange={setEscalateToOfficeRef}>
                <SelectTrigger>
                  <SelectValue placeholder="No escalation — stays at its assigned office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No escalation — stays at its assigned office</SelectItem>
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
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
