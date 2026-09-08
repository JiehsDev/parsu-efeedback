// src/lib/api-guards.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAdminScope, type AdminScope } from "@/lib/admin-scope";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "administrator") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// Offices/Users/Complaints routes use this instead of requireAdmin() — it
// additionally admits the three scoped sub-admin roles (vpaa/vpaf/osas),
// returning the AdminScope the caller must filter its query by. Categories/
// Routing Rules/SLA Rules/Settings/Audit Logs/Notifications-broadcast keep
// requireAdmin() unchanged, which alone 403s these three roles out of them.
export async function requireScopedAdmin(): Promise<
  { session: NonNullable<Awaited<ReturnType<typeof auth>>>; scope: AdminScope; error?: undefined } | { error: NextResponse }
> {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { role } = session.user;
  if (role !== "administrator" && role !== "vpaa" && role !== "vpaf" && role !== "osas") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, scope: getAdminScope(role) };
}