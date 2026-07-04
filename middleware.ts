import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { isRouteAllowed, homeRouteForRole } from "@/middleware/rbac";

// Edge-runtime auth() built from the edge-safe config only — see the
// header comment in src/lib/auth.config.ts for why this can't import
// src/lib/auth.ts (that one pulls in mongoose + bcrypt via the
// Credentials provider, which the Edge runtime can't execute).
const { auth } = NextAuth(authConfig);

// Implements docs/architecture.md section 6 ("RBAC Flow"):
//   1. Extract JWT (done for us by the `auth()` wrapper below)
//   2. Match request path against the route access table (rbac.ts)
//   3. No match → redirect to /login or return 403 JSON for API routes
//
// Step 4 onward (re-check role explicitly + scope the query inside each
// handler) is deliberately NOT here — that's the handlers' job, added as
// each feature (complaints, admin, etc.) is implemented in later phases.
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isRouteAllowed(pathname, session.user.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(
      new URL(homeRouteForRole(session.user.role), request.nextUrl),
    );
  }

  return NextResponse.next();
});

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
