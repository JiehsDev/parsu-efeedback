// src/components/admin/EditUserButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useToast } from "@/components/shared/Toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_ROLES = ["student", "office_staff", "administrator", "vpaa", "vpaf", "osas"];

// Which roles/offices a sub-admin's scope permits editing into — mirrors
// the server-side check in api/admin/users/[id]/route.ts's isUserInScope.
type ScopeKind = "all" | "college_office" | "university_office" | "student";

function roleOptionsForScope(scopeKind: ScopeKind): string[] {
  if (scopeKind === "student") return ["student"];
  if (scopeKind === "college_office" || scopeKind === "university_office") {
    return ["office_staff"];
  }
  return ALL_ROLES;
}

interface EditableUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  officeRef: { _id: string } | null;
  collegeRef: { _id: string } | null;
}

interface OfficeOption {
  _id: string;
  name: string;
  code: string;
  type: string;
}

export function EditUserButton({
  user,
  offices,
  scopeKind = "all",
}: {
  user: EditableUser;
  offices: OfficeOption[];
  scopeKind?: ScopeKind;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    officeRef: user.officeRef?._id ?? "",
    collegeRef: user.collegeRef?._id ?? "",
    password: "",
  });

  const needsOffice = ["office_staff", "vpaa", "vpaf", "osas"].includes(form.role);
  const needsCollege = form.role === "student";
  const roleOptions = roleOptionsForScope(scopeKind);
  const officeOptionsForRole =
    scopeKind === "college_office" || scopeKind === "university_office"
      ? offices.filter((o) => o.type === scopeKind)
      : offices;
  const scopedOfficeCode = { vpaa: "OVPAA", vpaf: "OVPAF", osas: "OSAS" }[form.role as "vpaa" | "vpaf" | "osas"];
  const officeOptionsForSelectedRole = scopedOfficeCode
    ? officeOptionsForRole.filter((office) => office.code === scopedOfficeCode)
    : officeOptionsForRole;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      role: form.role,
      // Explicit nulls, not omission — switching a user away from a role
      // that needs an office/college must clear the stale ref, or the
      // account keeps pointing at an affiliation that no longer applies.
      officeRef: needsOffice ? form.officeRef || null : null,
      collegeRef: needsCollege ? form.collegeRef || null : null,
    };
    if (form.password) payload.password = form.password;

    const res = await fetch(`/api/admin/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update user.");
      return;
    }

    setIsOpen(false);
    setForm((p) => ({ ...p, password: "" }));
    showToast("User updated");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit User
      </button>

      {isOpen && (
        <Modal title="Edit User" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name">
                <input
                  required
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </FormField>
              <FormField label="Last name">
                <input
                  required
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField label="Email">
              <input
                type="email"
                required
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </FormField>

            <FormField label="Role">
              <Select value={form.role} onValueChange={(value) => setForm((p) => ({
                ...p,
                role: value,
                officeRef: value === "student" || value === "administrator" ? "" : p.officeRef,
                collegeRef: value === "student" ? p.collegeRef : "",
              }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {{ office_staff: "Office Staff", administrator: "Administrator", vpaa: "VPAA", vpaf: "VPAF", osas: "OSAS", student: "Student" }[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {needsOffice && (
              <FormField label="Office">
                <Select
                  value={form.officeRef}
                  onValueChange={(value) => setForm((p) => ({ ...p, officeRef: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent>
                    {officeOptionsForSelectedRole.map((o) => (
                      <SelectItem key={o._id} value={o._id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {needsCollege && (
              <FormField label="College">
                <Select
                  value={form.collegeRef}
                  onValueChange={(value) => setForm((p) => ({ ...p, collegeRef: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select college" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices
                      .filter((o) => o.type === "college_office")
                      .map((o) => (
                        <SelectItem key={o._id} value={o._id}>
                          {o.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <FormField label="New password" hint="Leave blank to keep the current password">
              <input
                type="password"
                minLength={8}
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </FormField>

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
