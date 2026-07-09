// src/app/dean/layout.tsx
import { auth } from "@/lib/auth";
import { DeanNav } from "@/components/dean/DeanNav";

export default async function DeanLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DeanNav userName={session?.user?.name ?? "Dean"} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
