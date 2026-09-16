"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileQuestion, Loader2, Send } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

type RequestRecord = {
  _id: string;
  requestMessage: string;
  context?: string;
  status: "open" | "responded";
  requestedAt: string;
  respondedAt?: string | null;
  responseMessage?: string;
};

export function InformationRequestPanel({
  complaintId,
  status,
  requests,
  canRequest = true,
}: {
  complaintId: string;
  status: string;
  requests: RequestRecord[];
  canRequest?: boolean;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const active = requests.find((request) => request.status === "open");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!requestMessage.trim()) {
      setError("The request message is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/information-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestMessage, context }),
      });
      const responseText = await res.text();
      let data: { error?: unknown } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Could not request information (${res.status}). Please try again.`,
        );
        return;
      }

      showToast("Information requested from student");
      setOpen(false);
      setRequestMessage("");
      setContext("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "pending_information" && active) {
    return (
      <div className="rounded-3xl border border-[var(--qa-amber)]/30 bg-[var(--qa-amber-soft)] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--qa-amber-strong)]">
          <FileQuestion className="h-4 w-4" />
          Awaiting student information
        </div>
        <p className="mt-3 text-sm text-[var(--qa-amber-strong)]">{active.requestMessage}</p>
        <p className="mt-2 text-xs text-[var(--qa-amber-strong)]/75">
          Requested {new Date(active.requestedAt).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!canRequest || status !== "in_progress"}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FileQuestion className="h-4 w-4" />
          Request Additional Information
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <FileQuestion className="h-4 w-4 text-[var(--primary)]" />
            Request Additional Information
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <textarea
            value={requestMessage}
            onChange={(event) => setRequestMessage(event.target.value)}
            rows={4}
            required
            placeholder="Tell the student exactly what information is needed."
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            rows={2}
            placeholder="Optional context or document instructions"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !requestMessage.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send request
            </button>
          </div>
        </form>
      )}
      {requests.filter((request) => request.status === "responded").length > 0 && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Previous information cycles
          </p>
          <div className="mt-3 space-y-3">
            {requests
              .filter((request) => request.status === "responded")
              .map((request) => (
                <div
                  key={request._id}
                  className="rounded-2xl bg-[var(--muted)]/45 px-3 py-2.5 text-xs"
                >
                  <p className="font-medium text-[var(--foreground)]">
                    Requested: {request.requestMessage}
                  </p>
                  <p className="mt-1 text-[var(--muted-foreground)]">
                    Response: {request.responseMessage || "Attachment submitted"}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
