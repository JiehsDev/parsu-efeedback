"use client";

import { clientFetch } from "@/lib/client-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function HandlePersonallyButton({
  complaintId,
  headId,
  needsReason,
}: {
  complaintId: string;
  headId: string;
  needsReason: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handle() {
    setBusy(true);
    try {
      const response = await clientFetch(`/api/complaints/${complaintId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: needsReason ? "reassign" : "assign",
          assignedStaffRef: headId,
          message: "Office Head handling personally.",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not assign complaint.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      <button
        onClick={handle}
        disabled={busy}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Assigning..." : "Handle Personally"}
      </button>
    </div>
  );
}
