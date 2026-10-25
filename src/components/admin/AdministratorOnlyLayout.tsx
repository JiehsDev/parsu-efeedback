import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";

export async function AdministratorOnlyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user.role !== "administrator") notFound();
  return children;
}
