"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-fetch";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from "./Toast";

export function ForwardingPanel({
  complaintId,
  head,
  canRequest,
  requests,
  base = "admin",
}: {
  base?: "admin" | "staff";
  complaintId: string;
  head: boolean;
  canRequest: boolean;
  requests: any[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("vpaa");
  const [reason, setReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = requests.find((item) => item.status === "pending");
  async function submit(action?: "approve" | "reject") {
    const note = action ? decisionReason.trim() : reason.trim();
    if ((!action || action === "reject") && !note) {
      setError("Please provide a reason.");
      return;
    }
    if (
      (action === "approve" || (!action && head)) &&
      !(await confirm({
        title: "Forward this complaint?",
        message: `Send this complaint to ${(pending?.requestedDestination ?? destination).toUpperCase()} for review? You will no longer be able to work on it here.`,
        confirmLabel: "Approve Forwarding",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await clientFetch(
        action
          ? `/api/forwarding-requests/${pending._id}`
          : `/api/complaints/${complaintId}/forwarding`,
        {
          method: action ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action ? { action, reason: note } : { destination, reason: note, direct: head },
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save forwarding.");
        return;
      }
      show(
        action === "reject"
          ? "Forwarding request rejected."
          : head
            ? "Complaint forwarded."
            : "Forwarding request submitted.",
      );
      setOpen(false);
      setReason("");
      setDecisionReason("");
      // After forwarding OSAS no longer has complaint-detail access. Its request history remains available.
      if (head && action !== "reject") router.push(`/${base}/forwarding-requests`);
      else router.refresh();
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-sm font-semibold">Forwarding</h2>
      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      {pending ? (
        <div className="space-y-3 text-sm">
          <p className="font-medium">
            Pending forwarding to {pending.requestedDestination.toUpperCase()}
          </p>
          <p>
            Requested by {pending.requestedByUserRef?.firstName ?? "OSAS handler"}{" "}
            {pending.requestedByUserRef?.lastName ?? ""}
          </p>
          <p className="break-words whitespace-pre-wrap">{pending.reason}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {new Date(pending.requestedAt).toLocaleString()}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Awaiting the head’s decision.</p>
          {head && (
            <>
              <label className="block font-medium" htmlFor={`forward-decision-${complaintId}`}>
                Decision note (required to reject)
              </label>
              <textarea
                id={`forward-decision-${complaintId}`}
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                maxLength={4000}
                rows={3}
                className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] p-3"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !canRequest}
                  onClick={() => submit("approve")}
                  className="rounded-full bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)] disabled:opacity-50"
                >
                  Approve Forwarding
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit("reject")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 disabled:opacity-50"
                >
                  Reject Forwarding
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        canRequest && (
          <>
            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                {head ? "Forward Complaint" : "Request Forwarding"}
              </button>
            ) : (
              <form
                className="space-y-3 text-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <label className="block font-medium" htmlFor={`forward-destination-${complaintId}`}>
                  Destination
                </label>
                <select
                  id={`forward-destination-${complaintId}`}
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] p-3"
                >
                  <option value="vpaa">VPAA</option>
                  <option value="vpaf">VPAF</option>
                </select>
                <label className="block font-medium" htmlFor={`forward-reason-${complaintId}`}>
                  Forwarding reason
                </label>
                <textarea
                  id={`forward-reason-${complaintId}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  maxLength={4000}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--input)] bg-[var(--background)] p-3"
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  {head
                    ? "Choose an office and explain why its review is needed."
                    : "Add a reason for the head to review."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    type="submit"
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)] disabled:opacity-50"
                  >
                    {head ? "Forward Complaint" : "Submit Forwarding Request"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-[var(--border)] px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )
      )}
      {requests
        .filter((item) => item.status !== "pending")
        .map((item) => (
          <div key={item._id} className="space-y-1 border-t border-[var(--border)] pt-3 text-sm">
            <p className="font-medium">
              {item.requestedDestination.toUpperCase()}: {item.status}
            </p>
            <p className="break-words whitespace-pre-wrap">{item.reason}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Reviewed by {item.reviewedByUserRef?.firstName ?? "OSAS Head"}{" "}
              {item.reviewedByUserRef?.lastName ?? ""} ·{" "}
              {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : ""}
            </p>
            {item.reviewReason && (
              <p className="break-words whitespace-pre-wrap">{item.reviewReason}</p>
            )}
          </div>
        ))}
    </section>
  );
}
