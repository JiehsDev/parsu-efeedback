// src/components/shared/AttachmentGallery.tsx
"use client";

import { clientFetch } from "@/lib/client-fetch";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Paperclip, X } from "lucide-react";

interface AttachmentRecord {
  _id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export function AttachmentGallery({ complaintId }: { complaintId: string }) {
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AttachmentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [attachmentErrors, setAttachmentErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clientFetch(`/api/complaints/${complaintId}/attachments`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        setAttachments(data.attachments ?? []);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load attachment details."))
      .finally(() => setLoading(false));
  }, [complaintId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!preview) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [preview]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attachments…
      </div>
    );
  }

  if (attachments.length === 0) {
    if (loadError) return <p role="alert" className="text-sm text-red-500">Couldn’t load attachments: {loadError}</p>;
    return null; // no section shown at all when nothing's attached
  }

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const files = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  function downloadUrl(attachmentId: string) {
    return `/api/complaints/${complaintId}/attachments/${attachmentId}/download`;
  }

  async function fetchAttachment(attachment: AttachmentRecord) {
    setAttachmentErrors((current) => ({ ...current, [attachment._id]: "" }));
    try {
      const response = await clientFetch(downloadUrl(attachment._id));
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      return URL.createObjectURL(await response.blob());
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown storage error";
      setAttachmentErrors((current) => ({ ...current, [attachment._id]: reason }));
      return null;
    }
  }

  async function openPreview(attachment: AttachmentRecord) {
    const url = await fetchAttachment(attachment);
    if (url) {
      setPreviewUrl(url);
      setPreview(attachment);
    }
  }

  async function downloadAttachment(attachment: AttachmentRecord) {
    const url = await fetchAttachment(attachment);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function explainImageFailure(attachment: AttachmentRecord) {
    const url = await fetchAttachment(attachment);
    if (url) {
      URL.revokeObjectURL(url);
      setAttachmentErrors((current) => ({
        ...current,
        [attachment._id]: "The file was fetched, but the browser couldn’t display it as an image.",
      }));
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]/15 text-[var(--secondary)]">
          <Paperclip className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Attachments ({attachments.length})
        </p>
      </div>

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => (
            <button
              key={img._id}
              type="button"
              onClick={() => void openPreview(img)}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)]"
            >
              <span className="sr-only">Preview {img.fileName}</span>
              {attachmentErrors[img._id] ? (
                <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-red-500">
                  Couldn’t load image: {attachmentErrors[img._id]}
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={downloadUrl(img._id)} alt={img.fileName} onError={() => void explainImageFailure(img)} className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
              )}
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((file) => (
            <li key={file._id}>
              <div className="rounded-xl bg-[var(--muted)]/50 px-3 py-2.5 text-sm text-[var(--foreground)]">
                <button type="button" onClick={() => void downloadAttachment(file)} className="flex w-full items-center gap-2.5 text-left">
                <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <span className="truncate">{file.fileName}</span>
                <span className="ml-auto shrink-0 text-xs text-[var(--muted-foreground)]">
                  {(file.sizeBytes / 1024).toFixed(0)} KB
                </span>
                </button>
                {attachmentErrors[file._id] && <p role="alert" className="mt-2 text-xs text-red-500">Couldn’t fetch this attachment: {attachmentErrors[file._id]}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={preview.fileName}
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-black/85 p-6 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-4xl items-center justify-between">
            <p className="truncate text-sm font-medium text-white/90">{preview.fileName}</p>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={previewUrl ?? undefined}
                download={preview.fileName}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              <button
                onClick={() => setPreview(null)}
                aria-label="Close preview"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? undefined}
            alt={preview.fileName}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
