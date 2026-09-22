// src/app/student/complaints/new/page.tsx — full updated file
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Loader2,
  Paperclip,
  Send,
  Tag,
  UserCheck,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError, FieldLabel, focusFirstInvalid } from "@/components/ui/form-field";

interface Category {
  _id: string;
  name: string;
  description: string;
  defaultPriority: string;
}

const TIPS = [
  "Be specific — include dates, locations, and names of anyone involved.",
  "Attach evidence — screenshots, photos, or documents help staff resolve it faster.",
  "One issue per complaint — file separate complaints for unrelated concerns.",
];

const PROCESS_STEPS = [
  {
    icon: Send,
    title: "Submitted",
    description: "Logged instantly and given a ticket number you can track.",
  },
  {
    icon: Building2,
    title: "Routed",
    description: "Automatically sent to the office responsible for this category.",
  },
  {
    icon: UserCheck,
    title: "In progress",
    description: "A staff member picks it up and works your case.",
  },
  {
    icon: CheckCircle2,
    title: "Resolved",
    description: "You're notified and can rate how it was handled.",
  },
];

export default function NewComplaintPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ categoryRef: "", title: "", description: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    categoryRef?: string;
    title?: string;
    description?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  const selectedCategory = categories.find((c) => c._id === form.categoryRef);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadOneFile(file: File, complaintId: string) {
    // 1. Ask for a presigned R2 upload URL (BR-058/059/060/061)
    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complaintId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    const presignData = await presignRes.json();

    if (!presignRes.ok) {
      throw new Error(presignData.error ?? `Could not get upload URL for ${file.name}`);
    }

    // 2. Upload the actual bytes directly to R2 using the presigned URL
    const uploadRes = await fetch(presignData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload to storage failed for ${file.name}`);
    }

    // 3. Record the attachment metadata against the complaint
    const attachRes = await fetch(`/api/complaints/${complaintId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: presignData.fileUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });

    if (!attachRes.ok) {
      const data = await attachRes.json();
      throw new Error(data.error ?? `Could not save attachment record for ${file.name}`);
    }
  }
  // src/app/student/complaints/new/page.tsx — fix the error extraction
  function extractErrorMessage(data: any): string {
    if (typeof data?.error === "string") {
      return data.error;
    }

    const fieldErrors = data?.error?.fieldErrors as Record<string, string[]> | undefined;
    if (fieldErrors) {
      const errors: Record<string, string[]> = fieldErrors;
      const firstKey = Object.keys(errors).find((k) => (errors[k]?.length ?? 0) > 0);
      if (firstKey) return errors[firstKey]?.[0] ?? "Could not submit complaint.";
    }

    const formErrors = data?.error?.formErrors as string[] | undefined;
    if (formErrors && formErrors.length > 0) {
      return formErrors[0] ?? "Could not submit complaint.";
    }

    return "Could not submit complaint.";
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = {
      ...(!form.categoryRef ? { categoryRef: "Please select a complaint category." } : {}),
      ...(form.title.trim().length < 5
        ? { title: "Complaint title must be at least 5 characters." }
        : {}),
      ...(form.description.trim().length < 20
        ? { description: "Please describe your complaint in at least 20 characters." }
        : {}),
    };
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Please correct the highlighted fields below.");
      const formElement = event.currentTarget;
      requestAnimationFrame(() => focusFirstInvalid(formElement));
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(extractErrorMessage(data));
        setIsSubmitting(false);
        return;
      }
      const complaintId = data.complaint._id;

      // Upload attachments sequentially, after the complaint exists.
      // A failure here doesn't roll back the complaint — it's already
      // submitted successfully; we just report which file(s) failed so
      // the student knows to retry attaching those separately.
      const failedFiles: string[] = [];
      for (const [i, file] of files.entries()) {
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})…`);
        try {
          await uploadOneFile(file, complaintId);
        } catch {
          failedFiles.push(file.name);
        }
      }
      setUploadProgress(null);

      if (failedFiles.length > 0) {
        router.push(
          `/student/complaints/${complaintId}?attachmentWarning=${encodeURIComponent(
            `Complaint submitted, but ${failedFiles.length} file(s) failed to attach: ${failedFiles.join(", ")}`,
          )}`,
        );
        return;
      }

      router.push(`/student/complaints?submitted=${data.complaint.ticketNumber}`);
    } catch {
      setError("An unexpected system error occurred.");
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  const inputClass =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]/40 py-2.5 pl-10 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/student/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <ClipboardList className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Submit a Complaint
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Describe the issue clearly — this helps route it to the right office faster.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <FieldLabel htmlFor="categoryRef" required>
                Category
              </FieldLabel>
              <div className="relative">
                <Tag className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Select
                  value={form.categoryRef}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, categoryRef: value }))}
                >
                  <SelectTrigger
                    id="categoryRef"
                    aria-invalid={!!fieldErrors.categoryRef}
                    aria-describedby="complaint-category-error"
                    className="pl-10"
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldError id="complaint-category-error" message={fieldErrors.categoryRef} />
              {selectedCategory?.description && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {selectedCategory.description}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="title" required>
                Title
              </FieldLabel>
              <input
                id="title"
                required
                minLength={5}
                maxLength={200}
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  if (e.target.value.trim().length >= 5)
                    setFieldErrors((p) => ({ ...p, title: undefined }));
                }}
                aria-invalid={!!fieldErrors.title}
                aria-describedby="complaint-title-error"
                placeholder="Brief summary of the issue"
                className={inputClass}
              />
              <FieldError id="complaint-title-error" message={fieldErrors.title} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="description" required>
                Description
              </FieldLabel>
              <div className="relative">
                <AlignLeft className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--muted-foreground)]" />
                <textarea
                  id="description"
                  required
                  minLength={20}
                  rows={8}
                  value={form.description}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, description: e.target.value }));
                    if (e.target.value.trim().length >= 20)
                      setFieldErrors((p) => ({ ...p, description: undefined }));
                  }}
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby="complaint-description-error"
                  placeholder="Explain what happened, when, and any relevant details."
                  className={`${inputClass} py-3`}
                />
              </div>
              <FieldError id="complaint-description-error" message={fieldErrors.description} />
              <p className="text-xs text-[var(--muted-foreground)]">Minimum 20 characters.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="attachments" className="text-sm font-medium text-[var(--foreground)]">
                Attachments <span className="text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <label
                htmlFor="attachments"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)]/40 px-3 py-4 text-sm text-[var(--muted-foreground)] transition-colors hover:border-[var(--ring)] hover:text-[var(--foreground)]"
              >
                <Paperclip className="h-4 w-4" />
                Click to attach files, or drag them here
              </label>
              <input
                id="attachments"
                type="file"
                multiple
                onChange={handleFileChange}
                className="sr-only"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2.5 rounded-xl bg-[var(--muted)]/50 px-3 py-2 text-xs text-[var(--foreground)]"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="min-w-0 flex-1 truncate">
                        {file.name}{" "}
                        <span className="text-[var(--muted-foreground)]">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${file.name}`}
                        className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {uploadProgress ?? (isSubmitting ? "Submitting…" : "Submit Complaint")}
            </button>
          </form>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-sm font-medium text-[var(--foreground)]">
                Tips for a faster resolution
              </p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {TIPS.map((tip) => (
                <li
                  key={tip}
                  className="flex gap-2.5 text-xs leading-relaxed text-[var(--muted-foreground)]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">What happens next</p>
            <div className="mt-3">
              {PROCESS_STEPS.map((step, i) => (
                <div key={step.title} className="relative flex gap-2.5 pb-4 last:pb-0">
                  {i < PROCESS_STEPS.length - 1 && (
                    <span className="absolute top-7 left-[13px] h-[calc(100%-1rem)] w-px bg-[var(--border)]" />
                  )}
                  <span className="relative z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                    <step.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="pt-0.5">
                    <p className="text-xs font-medium text-[var(--foreground)]">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
