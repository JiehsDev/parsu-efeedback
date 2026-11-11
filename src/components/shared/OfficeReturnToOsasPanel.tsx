"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-fetch";
import { useToast } from "@/components/shared/Toast";

export function OfficeReturnToOsasPanel({
  complaintId,
  canRequest,
  requests,
}: {
  complaintId: string;
  canRequest: boolean;
  requests: any[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = requests.find((request) => request.status === "pending");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Explain why this complaint should return to OSAS (at least 10 characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await clientFetch(`/api/complaints/${complaintId}/return-to-osas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit the return request.");
        return;
      }
      show("Return request sent to the OSAS Office Head.");
      setReason("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not submit the return request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!requests.length && !canRequest) return null;

  return (
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-sm font-semibold">Return to OSAS</h2>
      {pending ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">Awaiting OSAS Office Head review</p>
          <p className="break-words whitespace-pre-wrap text-[var(--muted-foreground)]">
            {pending.reason}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Submitted {new Date(pending.requestedAt).toLocaleString()}
          </p>
        </div>
      ) : canRequest ? (
        <>
          <p className="text-sm text-[var(--muted-foreground)]">
            Ask the OSAS Office Head to return this complaint for reassignment. It remains with
            your office until the request is approved; its status and SLA deadlines are preserved.
          </p>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
            >
              Request return to OSAS
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {error && <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p>}
              <label htmlFor={`office-return-reason-${complaintId}`} className="block text-sm font-medium">
                Why was this complaint sent to the wrong office?
              </label>
              <textarea
                id={`office-return-reason-${complaintId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                disabled={busy}
                placeholder="Explain why OSAS should review and reassign this complaint"
                className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] p-3 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy || reason.trim().length < 10}
                  className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
                >
                  {busy ? "Sending request…" : "Send return request"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    setError("");
                  }}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request._id} className="border-t border-[var(--border)] pt-3 text-sm first:border-0 first:pt-0">
              <p className="font-medium capitalize">Request {request.status}</p>
              <p className="mt-1 break-words whitespace-pre-wrap text-[var(--muted-foreground)]">
                {request.reason}
              </p>
              {request.reviewReason && (
                <p className="mt-1 break-words whitespace-pre-wrap">
                  OSAS note: {request.reviewReason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
