// src/app/admin/layout.tsx
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <AdminNav
        userName={session?.user?.name ?? "Admin"}
        role={session?.user?.role ?? "administrator"}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        {children}
      </main>
    </div>
  );
}
