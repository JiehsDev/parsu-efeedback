// src/app/staff/layout.tsx
import { auth } from "@/lib/auth";
import { StaffNav } from "@/components/staff/StaffNav";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <StaffNav userName={session?.user?.name ?? "Staff"} />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        {children}
      </main>
    </div>
  );
}
