// Route → role access table (docs/architecture.md section 6, "RBAC Flow").
//
// This only ever decides "is this role allowed to be on this *route* at
// all" — the coarse, path-based check middleware.ts can make from the
// JWT alone. It deliberately does NOT scope to a specific office/college
// (e.g. "is this staff member's office the one this complaint belongs
// to") — that's finer-grained than a path can express and, per the same
// doc section, must be re-checked inside each handler anyway
// ("defense in depth — never rely on middleware alone").
//
// Kept as pure, dependency-free functions (no next/server imports) so it
// stays trivially edge-safe and independently testable.

import type { UserRole } from "@/lib/constants";

// Order matters only in that the first matching prefix wins; keep
// longer/more-specific prefixes above shorter ones if that ever matters
// (not currently the case — every role has a disjoint top-level segment).
const ROLE_ROUTE_PREFIXES: Array<{ prefix: string; role: UserRole }> = [
  { prefix: "/student", role: "student" },
  { prefix: "/staff", role: "office_staff" },
  { prefix: "/dean", role: "college_dean" },
  { prefix: "/qa", role: "qa_office" },
  { prefix: "/admin", role: "administrator" },
  { prefix: "/api/admin", role: "administrator" },
];

/**
 * Returns the role required for a given pathname, or `null` if the path
 * isn't role-gated (e.g. shared API routes like /api/complaints, which
 * every authenticated role may hit — the handler itself scopes by role,
 * per architecture.md section 4).
 */
export function requiredRoleForPath(pathname: string): UserRole | null {
  // Check the more specific /api/admin prefix before the generic role
  // prefixes so it isn't mistakenly left unmatched (no role folder is
  // literally named "api").
  for (const { prefix, role } of ROLE_ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return role;
    }
  }
  return null;
}

/**
 * True if `role` may access `pathname` per the route table above.
 * A path with no required role is accessible to any authenticated user
 * (middleware.ts only calls this after confirming a session exists).
 */
export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  const requiredRole = requiredRoleForPath(pathname);
  return requiredRole === null || requiredRole === role;
}

/**
 * Where an authenticated-but-wrong-role user should land instead of the
 * page they tried to hit. Sends each role to its own dashboard rather
 * than a generic "403" page, since every role has one.
 */
export function homeRouteForRole(role: UserRole): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "office_staff":
      return "/staff/dashboard";
    case "college_dean":
      return "/dean/dashboard";
    case "qa_office":
      return "/qa/dashboard";
    case "administrator":
      return "/admin/dashboard";
  }
}
