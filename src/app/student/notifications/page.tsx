// src/app/student/notifications/page.tsx
import { Bell } from "lucide-react";
import { NotificationsPanel } from "@/components/shared/NotificationsPanel";

export default function StudentNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <Bell className="h-4 w-4" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Notifications
        </h1>
      </div>
      <NotificationsPanel complaintBasePath="/student/complaints" />
    </div>
  );
}
