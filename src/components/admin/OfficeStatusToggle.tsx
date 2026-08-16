// src/components/admin/OfficeStatusToggle.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";

export function OfficeStatusToggle({
  officeId,
  officeName,
  isActive,
}: {
  officeId: string;
  officeName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleToggle() {
    if (isActive) {
      const ok = await confirm({
        title: "Deactivate this office?",
        message: `"${officeName}" will stop being assignable to new complaints or staff.`,
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }

    setIsSubmitting(true);
    const res = await fetch(`/api/admin/offices/${officeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not update office.", "error");
      return;
    }
    showToast(isActive ? "Office deactivated" : "Office activated");
    router.refresh();
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isSubmitting}
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
        isActive
          ? "border border-[var(--destructive)]/40 text-[var(--destructive)]"
          : "bg-[var(--primary)] text-[var(--primary-foreground)]"
      }`}
    >
      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
      {isActive ? "Deactivate Office" : "Activate Office"}
    </button>
  );
}
