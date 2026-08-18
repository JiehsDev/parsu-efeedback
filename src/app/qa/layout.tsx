// src/app/qa/layout.tsx
import { auth } from "@/lib/auth";
import { QaNav } from "@/components/qa/QaNav";

export default async function QaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <QaNav userName={session?.user?.name ?? "QA"} />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">{children}</main>
    </div>
  );
}
