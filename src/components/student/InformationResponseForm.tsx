"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Send, X } from "lucide-react";
import { useToast } from "@/components/shared/Toast";

async function uploadFile(file: File, complaintId: string) {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      complaintId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const presignData = await presign.json();
  if (!presign.ok)
    throw new Error(
      typeof presignData.error === "string" ? presignData.error : `Could not prepare ${file.name}`,
    );
  const upload = await fetch(presignData.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) throw new Error(`Upload failed for ${file.name}`);
  const attach = await fetch(`/api/complaints/${complaintId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileUrl: presignData.fileUrl,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const attachData = await attach.json();
  if (!attach.ok)
    throw new Error(
      typeof attachData.error === "string" ? attachData.error : `Could not save ${file.name}`,
    );
  return String(attachData.attachment._id);
}

export function InformationResponseForm({
  complaintId,
  requestMessage,
  requestedAt,
  officeName,
}: {
  complaintId: string;
  requestMessage: string;
  requestedAt: string;
  officeName: string;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) {
      setError("Please explain the information you are submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const attachmentIds: string[] = [];
      for (const file of files) attachmentIds.push(await uploadFile(file, complaintId));
      const res = await fetch(`/api/complaints/${complaintId}/information-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseMessage: message, attachmentIds }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not submit information.",
        );
      setSubmitted(true);
      showToast("Information submitted");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not submit information.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted)
    return (
      <div className="rounded-2xl border border-[var(--qa-success)]/30 bg-[var(--qa-success-soft)] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--qa-success-strong)]">
          <CheckCircle2 className="h-4 w-4" />
          Information submitted
        </div>
        <p className="mt-2 text-sm text-[var(--qa-success-strong)]/80">
          Your response was sent to {officeName}. The complaint is back in progress.
        </p>
      </div>
    );

  return (
    <div className="rounded-2xl border border-[var(--qa-amber)]/30 bg-[var(--qa-amber-soft)] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--qa-amber-strong)]">
        <FileUp className="h-4 w-4" />
        Additional Information Requested
      </div>
      <p className="mt-3 text-sm text-[var(--qa-amber-strong)]">{requestMessage}</p>
      <p className="mt-2 text-xs text-[var(--qa-amber-strong)]/75">
        Requested by {officeName} on {new Date(requestedAt).toLocaleString()}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          required
          placeholder="Write your response"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]">
          <FileUp className="h-4 w-4 text-[var(--muted-foreground)]" />
          Add supporting files
          <input
            type="file"
            multiple
            onChange={(event) =>
              setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])
            }
            className="sr-only"
          />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit Information
        </button>
      </form>
    </div>
  );
}
