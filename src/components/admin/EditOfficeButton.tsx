// src/components/admin/EditOfficeButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditableOffice {
  _id: string;
  name: string;
  code: string;
  type: string;
}

interface OfficeOption {
  _id: string;
  name: string;
}

interface MemberOption {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
}

type ScopeKind = "all" | "college_office" | "university_office" | "student";

export function EditOfficeButton({
  office,
  parentOfficeId,
  headUserId,
  officeOptions,
  memberOptions,
  scopeKind = "all",
  canManageHead = false,
}: {
  office: EditableOffice;
  parentOfficeId: string | null;
  headUserId: string | null;
  officeOptions: OfficeOption[];
  memberOptions: MemberOption[];
  scopeKind?: ScopeKind;
  canManageHead?: boolean;
}) {
  // vpaa/vpaf may only manage offices in their own category — the Type
  // field is locked rather than offering a choice they'd be rejected for.
  const typeIsLocked = scopeKind === "college_office" || scopeKind === "university_office";
  const router = useRouter();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: office.name,
    code: office.code,
    type: office.type,
    parentOffice: parentOfficeId ?? "",
    headUserRef: headUserId ?? "",
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      code: form.code.toUpperCase(),
      type: form.type,
      parentOffice: form.parentOffice || null,
    };
    if (canManageHead) payload.headUserRef = form.headUserRef || null;

    const res = await fetch(`/api/admin/offices/${office._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update office.");
      return;
    }

    setIsOpen(false);
    showToast("Office updated");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit Office
      </button>

      {isOpen && (
        <Modal title="Edit Office" onClose={() => setIsOpen(false)}>
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

            <FormField label="Code" hint="Short unique code, e.g. CCIS, OUR">
              <input
                required
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
            </FormField>

            <FormField
              label="Type"
              hint={typeIsLocked ? "Locked to your own office category" : undefined}
            >
              <Select
                value={form.type}
                onValueChange={(value) => setForm((p) => ({ ...p, type: value }))}
                disabled={typeIsLocked}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="university_office">University Office</SelectItem>
                  <SelectItem value="college_office">College Office</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Parent office" hint="Optional — e.g. a department office under a college">
              <Select
                value={form.parentOffice}
                onValueChange={(value) => setForm((p) => ({ ...p, parentOffice: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {officeOptions
                    .filter((o) => o._id !== office._id)
                    .map((o) => (
                      <SelectItem key={o._id} value={o._id}>
                        {o.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>

            {canManageHead && (
              <FormField
                label="Office head"
                hint={
                  memberOptions.length === 0
                    ? "No staff assigned to this office yet"
                    : "Only active eligible users already assigned to this office can be head"
                }
              >
                <Select
                  value={form.headUserRef}
                  onValueChange={(value) => setForm((p) => ({ ...p, headUserRef: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not assigned</SelectItem>
                    {memberOptions.map((m) => (
                      <SelectItem key={m._id} value={m._id}>
                        {m.firstName} {m.lastName} · {({ office_staff: "Office Staff", vpaa: "VPAA", vpaf: "VPAF", osas: "OSAS" } as Record<string, string>)[m.role] ?? m.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

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
