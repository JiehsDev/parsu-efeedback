import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Placeholder root middleware.
//
// Phase 6 (Authentication) will replace this body with:
//   1. Auth.js getToken() to read the session JWT
//   2. Route-group → role matching (see docs/architecture.md, section 6: RBAC Flow)
//   3. Redirect to /login (pages) or 403 JSON (API routes) on mismatch
//
// The `matcher` below already scopes middleware to the route groups and API
// routes that will need protection, so no routing changes are expected later.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/student/:path*",
    "/staff/:path*",
    "/dean/:path*",
    "/qa/:path*",
    "/admin/:path*",
    "/api/complaints/:path*",
    "/api/uploads/:path*",
    "/api/reports/:path*",
    "/api/notifications/:path*",
    "/api/admin/:path*",
  ],
};
