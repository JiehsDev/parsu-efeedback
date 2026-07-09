// src/app/student/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function StudentError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-6 text-center">
      <p className="text-sm text-[var(--destructive)]">Something went wrong loading this page.</p>
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/student/dashboard"
          className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
