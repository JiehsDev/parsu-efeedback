// src/app/staff/layout.tsx
import { auth } from "@/lib/auth";
import { StaffNav } from "@/components/staff/StaffNav";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Office } from "@/models/Office";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "office_staff" && session.user.role !== "administrator") {
    redirect("/dashboard");
  }
  let isOfficeHead = false;
  if (session.user.officeRef) {
    await connectToDatabase();
    isOfficeHead = Boolean(
      await Office.exists({
        _id: session.user.officeRef,
        headUserRef: session.user.id,
        isActive: true,
      }),
    );
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <StaffNav userName={session?.user?.name ?? "Staff"} isOfficeHead={isOfficeHead} />
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 pb-12 sm:px-6 sm:py-10 sm:pb-14 lg:px-10">
        {children}
      </main>
    </div>
  );
}
