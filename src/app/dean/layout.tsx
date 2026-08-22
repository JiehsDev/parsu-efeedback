// src/app/dean/layout.tsx
import { auth } from "@/lib/auth";
import { DeanNav } from "@/components/dean/DeanNav";

export default async function DeanLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <DeanNav userName={session?.user?.name ?? "Dean"} />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        {children}
      </main>
    </div>
  );
}
