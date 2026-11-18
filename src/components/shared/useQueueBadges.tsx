"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PATH_KEYS: Record<string, string> = {
  "/student/complaints": "complaints",
  "/staff/complaints": "complaints",
  "/staff/complaints/archived": "archived",
  "/admin/complaints": "complaints",
  "/admin/feedback": "feedback",
  "/admin/users": "users",
  "/staff/forwarding-requests": "forwarding",
  "/admin/forwarding-requests": "forwarding",
  "/staff/archive-requests": "archive",
  "/admin/archive-requests": "archive",
  "/staff/resolution-requests": "resolution",
  "/admin/resolution-requests": "resolution",
  "/staff/dismissal-requests": "dismissal",
  "/admin/dismissal-requests": "dismissal",
  "/staff/office-return-requests": "return",
  "/admin/office-return-requests": "return",
};

export function queueKeyForHref(href: string): string | null {
  const [path, query] = href.split("?");
  if (path === "/admin/complaints" && new URLSearchParams(query).get("archived") === "1")
    return "archived";
  return PATH_KEYS[path ?? ""] ?? null;
}

export function useQueueBadges() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/queue-badges", { cache: "no-store" });
      if (response.ok) setCounts((await response.json()).counts ?? {});
    } catch {
      // Retain the last known counts until connectivity returns.
    }
  }, []);
  const markChecked = useCallback(
    async (key: string) => {
      try {
        const response = await fetch("/api/queue-badges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        if (response.ok) {
          setCounts((current) => ({ ...current, [key]: 0 }));
          await refresh();
        }
      } catch {
        // Keep the badge when the check could not be saved.
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const key = queueKeyForHref(`${pathname}?${search}`);
    if (!key) return;
    void markChecked(key);
  }, [pathname, search, markChecked]);

  return { counts, markChecked };
}

export function QueueBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} new items`}
      className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-[var(--destructive)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--destructive-foreground)] lg:right-3"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
