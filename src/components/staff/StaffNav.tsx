// src/components/staff/StaffNav.tsx
"use client";

import { clientFetch } from "@/lib/client-fetch";

import Link from "next/link";
import { isNavigationItemActive } from "@/lib/navigation";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutWithCacheReset } from "@/lib/client-sign-out";
import { useEffect, useId, useRef, useState } from "react";
import {
  Archive,
  Bell,
  ClipboardCheck,
  Inbox,
  LayoutGrid,
  LogOut,
  FileBarChart,
  CornerUpLeft,
  Timer,
  UserRound,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/staff/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/staff/complaints", label: "Complaints", icon: Inbox },
  {
    href: "/staff/office-return-requests",
    label: "Return to OSAS",
    icon: CornerUpLeft,
    requiresOfficeReturnHead: true,
  },
  {
    href: "/staff/forwarding-requests",
    label: "Forwarding Requests",
    icon: Inbox,
    requiresOsas: true,
  },
  { href: "/staff/sla", label: "SLA deadlines", icon: Timer },
  { href: "/staff/reports", label: "Reports", icon: FileBarChart },
  { href: "/staff/archive-requests", label: "Archive Requests", icon: Archive, requiresHead: true },
  {
    href: "/staff/resolution-requests",
    label: "Resolution Requests",
    icon: ClipboardCheck,
    requiresResolutionHead: true,
  },
  { href: "/staff/complaints/archived", label: "Archived Complaints", icon: Archive },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function StaffNav({
  userName,
  isOfficeHead = false,
  officeLabel = "OSAS",
  showForwarding = true,
  canReviewResolutionRequests = false,
  canReviewOfficeReturnRequests = false,
}: {
  userName: string;
  isOfficeHead?: boolean;
  officeLabel?: string;
  showForwarding?: boolean;
  canReviewResolutionRequests?: boolean;
  canReviewOfficeReturnRequests?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const confirm = useConfirm();
  const accountId = useId();
  const [unreadCount, setUnreadCount] = useState(0);
  const [resolutionRequestCount, setResolutionRequestCount] = useState(0);
  const [officeReturnRequestCount, setOfficeReturnRequestCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clientFetch("/api/notifications?unreadOnly=true")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unreadCount ?? 0))
      .catch(() => setUnreadCount(0));
  }, []);

  useEffect(() => {
    if (!canReviewResolutionRequests) return;
    let active = true;
    async function refreshResolutionRequestCount() {
      try {
        const response = await clientFetch("/api/resolution-requests");
        if (!response.ok) throw new Error("Could not load pending resolution requests.");
        const data = await response.json();
        if (active) {
          setResolutionRequestCount(Array.isArray(data.requests) ? data.requests.length : 0);
        }
      } catch (error) {
        console.error("Could not refresh resolution request count:", error);
      }
    }

    void refreshResolutionRequestCount();
    const intervalId = window.setInterval(() => {
      void refreshResolutionRequestCount();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [canReviewResolutionRequests]);

  useEffect(() => {
    if (!canReviewOfficeReturnRequests) return;
    let active = true;
    async function refreshCount() {
      try {
        const response = await clientFetch("/api/office-return-requests");
        if (!response.ok) throw new Error("Could not load OSAS return requests.");
        const data = await response.json();
        if (active) setOfficeReturnRequestCount(Array.isArray(data.requests) ? data.requests.length : 0);
      } catch (error) {
        console.error("Could not refresh OSAS return request count:", error);
      }
    }
    void refreshCount();
    const intervalId = window.setInterval(() => void refreshCount(), 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [canReviewOfficeReturnRequests]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const initials = getInitials(userName);
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.requiresHead || isOfficeHead) &&
      (!item.requiresOsas || showForwarding) &&
      (!item.requiresOfficeReturnHead || canReviewOfficeReturnRequests) &&
      (!item.requiresResolutionHead || canReviewResolutionRequests),
  );
  const roleLabel = `${officeLabel} ${isOfficeHead ? "Head" : "Staff"}`;

  async function handleSignOut() {
    const confirmed = await confirm({
      title: "Sign out?",
      message: "Are you sure you want to sign out?",
      confirmLabel: "Sign out",
      danger: true,
    });
    if (!confirmed) return;
    setMenuOpen(false);
    await signOutWithCacheReset();
  }

  return (
    <aside className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-white/15 bg-[var(--navigation)] lg:w-56">
      <Link href="/staff/dashboard" className="flex shrink-0 items-center gap-2.5 px-4 py-5">
        <BrandLogo />
        <span className="hidden text-[13px] font-bold tracking-tight text-white lg:inline">
          ParSU Staff
        </span>
      </Link>

      <nav
        aria-label="Main navigation"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2"
      >
        {visibleItems.map((item) => {
          const active = isNavigationItemActive(
            pathname,
            search,
            item.href,
            visibleItems.map((entry) => entry.href),
          );
          const link = (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-all ${
                active
                  ? "bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]"
                  : "font-medium text-white hover:bg-black/10 hover:text-white"
              }`}
            >
              <item.icon className="h-[17px] w-[17px] shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
          if (
            (item.href !== "/staff/resolution-requests" || resolutionRequestCount === 0) &&
            (item.href !== "/staff/office-return-requests" || officeReturnRequestCount === 0)
          )
            return link;
          const badgeCount =
            item.href === "/staff/office-return-requests"
              ? officeReturnRequestCount
              : resolutionRequestCount;
          return (
            <div key={item.href} className="relative">
              {link}
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-[var(--destructive)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--destructive-foreground)] lg:right-3">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 px-2.5 py-2">
        <ThemeSwitcher sidebar onPrimary />
      </div>

      <div className="shrink-0 border-t border-white/15 p-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Link
            href="/staff/notifications"
            title="Notifications"
            aria-label="Notifications"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-black/10 hover:text-white"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold text-[var(--destructive-foreground)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="relative min-w-0 flex-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account options"
              aria-controls={menuOpen ? accountId : undefined}
              aria-expanded={menuOpen}
              className="flex w-full items-center gap-2 rounded-full py-0.5 pr-1 transition-colors hover:bg-black/10"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/10 text-[11px] font-bold text-white">
                {initials}
              </span>
              <span className="hidden min-w-0 flex-1 text-left lg:block">
                <span className="block truncate text-[12.5px] font-semibold text-white">
                  {userName}
                </span>
                <span className="block truncate text-[10.5px] text-white">{roleLabel}</span>
              </span>
            </button>

            {menuOpen && (
              <div
                id={accountId}
                aria-label="Account options"
                className="motion-popover motion-popover-up absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20"
              >
                <div className="border-b border-[var(--border)] px-3.5 py-3">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {userName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">{roleLabel}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/staff/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                  >
                    <UserRound className="h-4 w-4 text-[var(--muted-foreground)]" />
                    Profile settings
                  </Link>
                  <button
                    onClick={() => {
                      void handleSignOut();
                    }}
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
