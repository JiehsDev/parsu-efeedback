// src/components/admin/EditRoutingRuleButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OfficeOption {
  _id: string;
  name: string;
}

export function EditRoutingRuleButton({
  categoryId,
  rule,
  offices,
}: {
  categoryId: string;
  rule: { _id: string; targetOfficeRef: string } | null;
  offices: OfficeOption[];
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [targetOfficeRef, setTargetOfficeRef] = useState(rule?.targetOfficeRef ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const url = rule ? `/api/admin/routing-rules/${rule._id}` : "/api/admin/routing-rules";
    const res = await fetch(url, {
      method: rule ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        rule ? { targetOfficeRef } : { categoryRef: categoryId, targetOfficeRef },
      ),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save routing rule.");
      return;
    }

    setIsOpen(false);
    showToast(rule ? "Routing rule updated" : "Routing rule created");
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
            Add routing rule
          </>
        )}
      </button>

      {isOpen && (
        <Modal title={rule ? "Edit Routing Rule" : "Add Routing Rule"} onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormField label="Target office">
              <Select value={targetOfficeRef} onValueChange={setTargetOfficeRef}>
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
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

            <button
              type="submit"
              disabled={isSubmitting || !targetOfficeRef}
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
