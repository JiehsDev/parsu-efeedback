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

  const cacheScope = [session.user.id, session.user.role, session.user.officeRef ?? "", session.user.collegeRef ?? "", session.user.tokenVersion].join(":");

  return (
    <ClientDataBoundary scope={cacheScope}>
    <div className="flex h-screen bg-[var(--background)]">
      <StaffNav userName={session?.user?.name ?? "Staff"} isOfficeHead={isOfficeHead} />
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 pb-12 sm:px-6 sm:py-10 sm:pb-14 lg:px-10">
        {children}
      </main>
    </div>
    </ClientDataBoundary>
  );
}
