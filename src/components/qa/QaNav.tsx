// src/components/qa/QaNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/qa/dashboard", label: "Dashboard" },
  { href: "/qa/complaints", label: "All Complaints" },
  { href: "/qa/analytics", label: "Analytics" },
  { href: "/qa/reports", label: "Reports" },
];

export function QaNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <span className="font-semibold text-[var(--foreground)]">ParSU e-Feedback</span>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--muted-foreground)]">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
