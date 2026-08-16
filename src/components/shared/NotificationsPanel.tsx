// src/components/shared/NotificationsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationDot } from "./NotificationIcon";
import { RelativeTime } from "./RelativeTime";
import { ListRowsSkeleton } from "./Skeleton";

interface NotificationRecord {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  relatedComplaintRef: string | null;
  createdAt: string;
}

export function NotificationsPanel({ complaintBasePath }: { complaintBasePath: string }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  function refresh() {
    const url = filter === "unread" ? "/api/notifications?unreadOnly=true" : "/api/notifications";
    fetch(url)
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [filter]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "unread"
                ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                : "border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Unread
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <ListRowsSkeleton />
      ) : notifications.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const content = (
              <div
                className={`flex gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4 transition-colors ${
                  n.isRead ? "bg-[var(--card)]" : "bg-[var(--muted)]/50"
                }`}
              >
                <NotificationDot type={n.type} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">{n.title}</p>
                    <RelativeTime
                      date={n.createdAt}
                      className="shrink-0 text-xs text-[var(--muted-foreground)]"
                    />
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{n.body}</p>
                </div>
              </div>
            );

            return (
              <li key={n._id}>
                {n.relatedComplaintRef ? (
                  <Link
                    href={`${complaintBasePath}/${n.relatedComplaintRef}`}
                    onClick={() => !n.isRead && markRead(n._id)}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    onClick={() => !n.isRead && markRead(n._id)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
