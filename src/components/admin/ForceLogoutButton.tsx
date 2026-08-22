// src/components/admin/ForceLogoutButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";

export function ForceLogoutButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const confirm = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    const ok = await confirm({
      title: "Force sign-out on all devices?",
      message: `${userName} will be signed out everywhere immediately and must log in again. Their password is not affected.`,
      confirmLabel: "Force sign-out",
      danger: true,
    });
    if (!ok) return;

    setIsSubmitting(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceLogout: true }),
    });
    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Could not force sign-out.", "error");
      return;
    }
    showToast("Signed out on all devices");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
    >
      <LogOut className="h-3 w-3" />
      Force sign-out
    </button>
  );
}
