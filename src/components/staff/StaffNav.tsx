// src/components/staff/StaffNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Bell, Inbox, LayoutGrid, LogOut, Timer, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { href: "/staff/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/staff/complaints", label: "Queue", icon: Inbox },
  { href: "/staff/sla", label: "SLA", icon: Timer },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function StaffNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications?unreadOnly=true")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unreadCount ?? 0))
      .catch(() => setUnreadCount(0));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const initials = getInitials(userName);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[var(--card)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center gap-6">
          <Link href="/staff/dashboard" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
              P
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-[var(--foreground)] sm:inline">
              ParSU Staff
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 rounded-full bg-[var(--muted)]/50 p-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/30 transition-transform hover:scale-105"
            >
              {initials}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20"
              >
                <div className="border-b border-[var(--border)] px-3.5 py-3">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {userName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Office Staff</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/staff/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                  >
                    <UserRound className="h-4 w-4 text-[var(--muted-foreground)]" />
                    Profile settings
                  </Link>
                  <button
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
