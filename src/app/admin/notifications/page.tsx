// src/app/admin/notifications/page.tsx
import { Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { NotificationsPanel } from "@/components/shared/NotificationsPanel";
import { BroadcastComposer } from "@/components/admin/BroadcastComposer";

export default async function AdminNotificationsPage() {
  const session = await auth();
  const canBroadcast = session?.user.role === "administrator";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
          <Bell className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Notifications
        </h1>
      </div>
      {canBroadcast && <BroadcastComposer />}
      <NotificationsPanel complaintBasePath="/admin/complaints" />
    </div>
  );
}
