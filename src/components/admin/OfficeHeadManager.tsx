"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, UserPlus, UserRound, X } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { FormField, inputClass } from "@/components/admin/FormField";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MemberOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export function OfficeHeadManager({
  officeId,
  currentHeadId,
  memberOptions,
}: {
  officeId: string;
  currentHeadId: string | null;
  memberOptions: MemberOption[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { show: showToast } = useToast();
  const [mode, setMode] = useState<"assign" | "create" | null>(null);
  const [selectedHeadId, setSelectedHeadId] = useState(currentHeadId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    employeeOrStudentId: "",
    password: "",
  });

  const hasHead = Boolean(currentHeadId);

  async function assignHead(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedHeadId) return;
    setError(null);
    setIsSubmitting(true);
    const res = await fetch(`/api/admin/offices/${officeId}/head`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headUserRef: selectedHeadId }),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not assign office head.");
      return;
    }
    showToast(hasHead ? "Office head changed" : "Office head assigned");
    setMode(null);
    router.refresh();
  }

  async function createHead(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const res = await fetch(`/api/admin/offices/${officeId}/head`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setIsSubmitting(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create office head.");
      return;
    }
    showToast("Office head account created");
    setMode(null);
    setForm({ firstName: "", lastName: "", email: "", employeeOrStudentId: "", password: "" });
    router.refresh();
  }

  async function removeHead() {
    const ok = await confirm({
      title: "Remove office head?",
      message: "The user account will remain active, but this office will no longer have a head.",
      confirmLabel: "Remove Head",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/admin/offices/${officeId}/head`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not remove office head.", "error");
      return;
    }
    showToast("Office head removed");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedHeadId(currentHeadId ?? "");
            setError(null);
            setMode("assign");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <UserRound className="h-3.5 w-3.5" />
          {hasHead ? "Change Head" : "Assign Head"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("create");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Create Head Account
        </button>
        {hasHead && (
          <button
            type="button"
            onClick={removeHead}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--destructive)]/40 px-3 py-2 text-xs font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          >
            <X className="h-3.5 w-3.5" />
            Remove Head
          </button>
        )}
      </div>

      {mode === "assign" && (
        <Modal title={hasHead ? "Change Office Head" : "Assign Office Head"} onClose={() => setMode(null)}>
          <form onSubmit={assignHead} className="space-y-4">
            {error && <ErrorMessage message={error} />}
            <FormField label="Office head" hint="Only active users assigned to this office are eligible.">
              <Select value={selectedHeadId} onValueChange={setSelectedHeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {memberOptions.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.firstName} {member.lastName} · {({ office_staff: "Office Staff", vpaa: "VPAA", vpaf: "VPAF", osas: "OSAS" } as Record<string, string>)[member.role] ?? member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <SubmitButton loading={isSubmitting} disabled={!selectedHeadId}>
              {hasHead ? "Change Head" : "Assign Head"}
            </SubmitButton>
          </form>
        </Modal>
      )}

      {mode === "create" && (
        <Modal title="Create Head Account" onClose={() => setMode(null)}>
          <form onSubmit={createHead} className="space-y-4">
            {error && <ErrorMessage message={error} />}
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Changing this assignment changes the organizational head only. The selected user keeps their existing software role and permissions.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name">
                <input required className={inputClass} value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
              </FormField>
              <FormField label="Last name">
                <input required className={inputClass} value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Email">
              <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </FormField>
            <FormField label="Employee ID">
              <input required className={inputClass} value={form.employeeOrStudentId} onChange={(e) => setForm((p) => ({ ...p, employeeOrStudentId: e.target.value }))} />
            </FormField>
            <FormField label="Temporary password">
              <input required type="password" minLength={8} className={inputClass} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </FormField>
            <SubmitButton loading={isSubmitting}>Create Head Account</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SubmitButton({
  children,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "Saving..." : children}
    </button>
  );
}
