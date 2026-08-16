// src/components/shared/CopyButton.tsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "./Toast";

export function CopyButton({
  value,
  label = "ticket number",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      show(`Copied ${label}`, "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      show(`Could not copy ${label}`, "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] ${className}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
