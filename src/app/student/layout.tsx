import { ClientDataBoundary } from "@/components/shared/ClientDataBoundary";
// src/app/student/layout.tsx
import { auth } from "@/lib/auth";
import { StudentNav } from "@/components/student/StudentNav";
import { redirect } from "next/navigation";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "student") {
    redirect("/dashboard");
  }

  const cacheScope = [
    session.user.id,
    session.user.role,
    session.user.officeRef ?? "",
    session.user.collegeRef ?? "",
    session.user.tokenVersion,
  ].join(":");

  return (
    <ClientDataBoundary key={cacheScope} scope={cacheScope}>
      <div className="app-shell flex flex-col bg-[var(--background)]">
        <StudentNav userName={session?.user?.name ?? "Student"} />
        <main id="main-content" className="workspace">
          {children}
        </main>
      </div>
    </ClientDataBoundary>
  );
}
