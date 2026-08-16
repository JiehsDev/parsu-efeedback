// src/components/admin/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  FileBarChart,
  LayoutGrid,
  LogOut,
  Route,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Tag,
  Timer,
  UserRound,
  Users,
} from "lucide-react";

// Frequent, day-to-day destinations stay as top-level pills; everything
// else that's closer to one-time/occasional configuration is grouped under
// the "Configuration" dropdown below so the primary row stays uncrowded
// and actually lines up with the logo instead of wrapping to its own row.
const PRIMARY_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/offices", label: "Offices", icon: Building2 },
];

const CONFIG_NAV_ITEMS = [
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/routing-rules", label: "Routing Rules", icon: Route },
  { href: "/admin/sla-rules", label: "SLA Rules", icon: Timer },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications?unreadOnly=true")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unreadCount ?? 0))
      .catch(() => setUnreadCount(0));
  }, []);

  useEffect(() => {
    if (!menuOpen && !configOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (configOpen && configRef.current && !configRef.current.contains(event.target as Node)) {
        setConfigOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, configOpen]);

  // AdminNav lives in the layout and never unmounts across navigation, so
  // closing the dropdown has to happen here — reacting to the route
  // actually changing — rather than in each Link's onClick. Closing
  // on-click instead unmounts the Link mid-event and cancels Next's own
  // navigation before it completes.
  useEffect(() => {
    setMenuOpen(false);
    setConfigOpen(false);
  }, [pathname]);

  const initials = getInitials(userName);
  const isConfigActive = CONFIG_NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[var(--card)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
              P
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-[var(--foreground)] md:inline">
              ParSU Admin
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-[var(--muted)]/50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
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

            {/* Deliberately a sibling of <nav>, not nested inside it: nav has
                overflow-x-auto for horizontal pill scrolling, and setting
                overflow-x also forces overflow-y to clip per the CSS spec —
                any absolutely-positioned dropdown nested inside would get
                silently clipped away despite being present in the DOM. */}
            <div className="relative shrink-0" ref={configRef}>
              <button
                onClick={() => setConfigOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={configOpen}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isConfigActive
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Configuration</span>
                <ChevronDown
                  className={`h-3 w-3 shrink-0 transition-transform ${configOpen ? "rotate-180" : ""}`}
                />
              </button>

              {configOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20"
                >
                  <div className="p-1">
                    {CONFIG_NAV_ITEMS.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                            active
                              ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                              : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/notifications"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="relative shrink-0" ref={menuRef}>
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
                className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20"
              >
                <div className="border-b border-[var(--border)] px-3.5 py-3">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {userName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Administrator</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/admin/profile"
                    role="menuitem"
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
