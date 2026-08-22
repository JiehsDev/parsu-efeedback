// src/components/dean/DeanNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Bell, FileBarChart, Inbox, LayoutGrid, LogOut, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dean/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dean/complaints", label: "Complaints", icon: Inbox },
  { href: "/dean/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dean/reports", label: "Reports", icon: FileBarChart },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function DeanNav({ userName }: { userName: string }) {
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
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:w-56">
      <Link href="/dean/dashboard" className="flex shrink-0 items-center gap-2.5 px-4 py-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-xs font-bold text-[var(--card)]">
          P
        </span>
        <span className="hidden text-[13px] font-bold tracking-tight text-[var(--foreground)] lg:inline">
          ParSU Dean
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all ${
                active
                  ? "bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]"
                  : "font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <item.icon className="h-[17px] w-[17px] shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[var(--border)]/70 p-2.5">
        <div className="flex items-center gap-2">
          <Link
            href="/dean/notifications"
            title="Notifications"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="relative min-w-0 flex-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex w-full items-center gap-2 rounded-full py-0.5 pr-1 transition-colors hover:bg-[var(--muted)]/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[11px] font-bold text-[var(--foreground)]">
                {initials}
              </span>
              <span className="hidden min-w-0 flex-1 text-left lg:block">
                <span className="block truncate text-[12.5px] font-semibold text-[var(--foreground)]">
                  {userName}
                </span>
                <span className="block truncate text-[10.5px] text-[var(--muted-foreground)]">
                  College Dean
                </span>
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20"
              >
                <div className="border-b border-[var(--border)] px-3.5 py-3">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {userName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">College Dean</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/dean/profile"
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
    </aside>
  );
}
