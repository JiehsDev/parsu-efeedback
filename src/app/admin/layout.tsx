// src/app/admin/layout.tsx
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["administrator", "vpaa", "vpaf", "osas"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <AdminNav
        userName={session?.user?.name ?? "Admin"}
        role={session?.user?.role ?? "administrator"}
      />
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-10 sm:px-6 sm:py-5 sm:pb-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
