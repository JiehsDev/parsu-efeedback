// src/app/admin/users/page.tsx
import { auth } from "@/lib/auth";
import { getAdminScope } from "@/lib/admin-scope";
import { AdminUsersPageClient } from "@/components/admin/AdminUsersPageClient";

export default async function AdminUsersPage() {
  const session = await auth();
  const scope = getAdminScope(session!.user.role);

  return <AdminUsersPageClient scopeKind={scope.kind} />;
}
