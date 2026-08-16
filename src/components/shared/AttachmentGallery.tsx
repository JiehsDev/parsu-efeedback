// src/components/shared/AttachmentGallery.tsx
"use client";

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
  const [preview, setPreview] = useState<AttachmentRecord | null>(null);

  useEffect(() => {
    fetch(`/api/complaints/${complaintId}/attachments`)
      .then((res) => res.json())
      .then((data) => setAttachments(data.attachments ?? []))
      .finally(() => setLoading(false));
  }, [complaintId]);

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
    return null; // no section shown at all when nothing's attached
  }

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const files = attachments.filter((a) => !a.mimeType.startsWith("image/"));

  function downloadUrl(attachmentId: string) {
    return `/api/complaints/${complaintId}/attachments/${attachmentId}/download`;
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
              onClick={() => setPreview(img)}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={downloadUrl(img._id)}
                alt={img.fileName}
                className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
              />
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((file) => (
            <li key={file._id}>
              <a
                href={downloadUrl(file._id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-[var(--muted)]/50 px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <span className="truncate">{file.fileName}</span>
                <span className="ml-auto shrink-0 text-xs text-[var(--muted-foreground)]">
                  {(file.sizeBytes / 1024).toFixed(0)} KB
                </span>
              </a>
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
                href={downloadUrl(preview._id)}
                target="_blank"
                rel="noopener noreferrer"
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
            src={downloadUrl(preview._id)}
            alt={preview.fileName}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
