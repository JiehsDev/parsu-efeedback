import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function AdministrationLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user.role !== "administrator") redirect("/admin/dashboard");
  return children;
}
