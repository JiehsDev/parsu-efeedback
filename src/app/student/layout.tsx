// src/app/student/layout.tsx
import { auth } from "@/lib/auth";
import { StudentNav } from "@/components/student/StudentNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <StudentNav userName={session?.user?.name ?? "Student"} />
      <main className="mx-auto min-h-0 w-full max-w-[1600px] flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        {children}
      </main>
    </div>
  );
}
