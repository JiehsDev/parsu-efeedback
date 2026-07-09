// src/app/staff/layout.tsx
import { auth } from "@/lib/auth";
import { StaffNav } from "@/components/staff/StaffNav";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <StaffNav userName={session?.user?.name ?? "Staff"} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
