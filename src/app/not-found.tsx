// src/app/not-found.tsx
"use client";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center">
        <p className="font-mono text-xs text-[var(--muted-foreground)]">404</p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          This page doesn't exist, or you don't have access to it.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}
