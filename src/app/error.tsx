// src/app/error.tsx
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          An unexpected error occurred. You can try again, or come back later if this keeps
          happening.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
