import { ClientDataBoundary } from "@/components/shared/ClientDataBoundary";
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

  const cacheScope = [
    session.user.id,
    session.user.role,
    session.user.officeRef ?? "",
    session.user.collegeRef ?? "",
    session.user.tokenVersion,
  ].join(":");

  return (
    <ClientDataBoundary key={cacheScope} scope={cacheScope}>
      <div className="app-shell flex bg-[var(--background)]">
        <AdminNav
          userName={session?.user?.name ?? "Admin"}
          role={session?.user?.role ?? "administrator"}
        />
        <main id="main-content" className="workspace">
          {children}
        </main>
      </div>
    </ClientDataBoundary>
  );
}
