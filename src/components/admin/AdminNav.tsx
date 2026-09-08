// src/components/admin/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  FileBarChart,
  Inbox,
  LayoutGrid,
  LogOut,
  Megaphone,
  MessageSquareText,
  ScrollText,
  Settings,
  Tag,
  Timer,
  UserRound,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/constants";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  office_staff: "Staff",
  qa_office: "QA Office",
  administrator: "Administrator",
  vpaa: "VPAA",
  vpaf: "VPAF",
  osas: "OSAS",
};

const PRIMARY_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/complaints", label: "Complaints", icon: Inbox },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/users", label: "Users", icon: Users },
  // osas manages students only, not Offices — CRUD there is meaningless.
  { href: "/admin/offices", label: "Offices", icon: Building2, hideFor: ["osas"] as UserRole[] },
  // Feedback has no office/college link — it's purely a student concern, so
  // only osas (among the sub-admins) gets it, not vpaa/vpaf.
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquareText,
    hideFor: ["vpaa", "vpaf"] as UserRole[],
  },
];

// A sidebar has room to just list these instead of tucking them behind a
// "Configuration" dropdown the way the old top-nav had to — a small
// section label does the same grouping without hiding anything.
const CONFIG_NAV_ITEMS = [
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/sla-rules", label: "SLA Rules", icon: Timer },
  // Same page the header's bell icon opens (every role treats notifications
  // as bell-only) — but this page is also the only place to send a
  // broadcast announcement, an admin-only capability that deserves its own
  // discoverable entry point rather than hiding behind a generic bell icon
  // identical to every other role's "view my own notifications" link.
  { href: "/admin/notifications", label: "Announcements", icon: Megaphone },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AdminNav({ userName, role }: { userName: string; role: UserRole }) {
  const pathname = usePathname();
  const isScopedSubAdmin = role === "vpaa" || role === "vpaf" || role === "osas";
  const roleLabel = ROLE_LABELS[role] ?? "Administrator";
  const primaryItems = PRIMARY_NAV_ITEMS.filter((item) => !item.hideFor?.includes(role));
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

  function renderItem(item: (typeof PRIMARY_NAV_ITEMS)[number]) {
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
  }

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:w-56">
      <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-2.5 px-4 py-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-xs font-bold text-[var(--card)]">
          P
        </span>
        <span className="hidden text-[13px] font-bold tracking-tight text-[var(--foreground)] lg:inline">
          ParSU Admin
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2">
        {primaryItems.map(renderItem)}

        {/* Categories/Routing/SLA Rules/Announcements/Audit Logs/Settings
            stay administrator-only — not shown to any scoped sub-admin. */}
        {!isScopedSubAdmin && (
          <>
            <p className="mt-3 mb-1 px-3 text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
              <span className="hidden lg:inline">Configuration</span>
              <span className="lg:hidden">···</span>
            </p>
            {CONFIG_NAV_ITEMS.map(renderItem)}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-[var(--border)]/70 p-2.5">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/notifications"
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
                  {roleLabel}
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
                  <p className="text-xs text-[var(--muted-foreground)]">{roleLabel}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/admin/profile"
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
