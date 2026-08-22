// src/app/qa/layout.tsx
import { auth } from "@/lib/auth";
import { QaNav } from "@/components/qa/QaNav";

export default async function QaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <QaNav userName={session?.user?.name ?? "QA"} />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        {children}
      </main>
    </div>
  );
}
