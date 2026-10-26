import { ClientDataBoundary } from "@/components/shared/ClientDataBoundary";
// src/app/staff/layout.tsx
import { auth } from "@/lib/auth";
import { StaffNav } from "@/components/staff/StaffNav";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { isOsasHead } from "@/lib/osas-operations";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "office_staff") {
    redirect("/dashboard");
  }
  await connectToDatabase();
  const isOfficeHead = await isOsasHead(session);

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
        <StaffNav userName={session?.user?.name ?? "Staff"} isOfficeHead={isOfficeHead} />
        <main id="main-content" className="workspace">
          {children}
        </main>
      </div>
    </ClientDataBoundary>
  );
}
