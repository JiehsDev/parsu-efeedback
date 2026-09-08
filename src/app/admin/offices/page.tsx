// src/app/admin/offices/page.tsx
import { auth } from "@/lib/auth";
import { getAdminScope } from "@/lib/admin-scope";
import { AdminOfficesPageClient } from "@/components/admin/AdminOfficesPageClient";

export default async function AdminOfficesPage() {
  const session = await auth();
  const scope = getAdminScope(session!.user.role);

  return <AdminOfficesPageClient scopeKind={scope.kind} />;
}
