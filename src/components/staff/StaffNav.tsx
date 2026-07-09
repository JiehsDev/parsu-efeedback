// src/components/staff/StaffNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/staff/dashboard", label: "Dashboard" },
  { href: "/staff/complaints", label: "Complaint Queue" },
];

export function StaffNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications?unreadOnly=true")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unreadCount ?? 0))
      .catch(() => setUnreadCount(0));
  }, []);

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
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--destructive)] px-2 py-0.5 text-xs font-semibold text-white">
              {unreadCount} new
            </span>
          )}
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
