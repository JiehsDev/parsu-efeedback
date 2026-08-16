// src/app/student/layout.tsx
import { auth } from "@/lib/auth";
import { StudentNav } from "@/components/student/StudentNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <StudentNav userName={session?.user?.name ?? "Student"} />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">{children}</main>
    </div>
  );
}
