// src/proxy.ts
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { isRouteAllowed, homeRouteForRole } from "@/middleware/rbac";
import type { UserRole } from "@/lib/constants";

// Initialize NextAuth with your edge configuration profile
const { auth } = NextAuth(authConfig);

/**
 * Next.js 16 Proxy Engine
 * * Named export 'proxy' intercepts every inbound HTTP layer request
 * before route segments or static asset pipelines resolve.
 */
// src/proxy.ts
// ... keep your imports and NextAuth initialization the same

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const currentPath = nextUrl.pathname;

  const userRole = (req.auth?.user?.role || (req.auth as any)?.role) as UserRole | undefined;

  // 1. Define Guest-Only routes (Authenticated users should NEVER see these)
  const isGuestRoute = ["/login", "/register"].some((route) => currentPath.startsWith(route));

  // 2. Define completely public routes (unrestricted developer endpoints, assets, etc.)
  const isPublicRoute = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/dev/seed",
  ].some((route) => currentPath.startsWith(route));

  // Handle Guest-Only Navigation. Deliberately NOT auto-redirecting an
  // "already logged in" visitor away from here: `isLoggedIn` above is only
  // ever a raw JWT decode (the edge runtime can't touch the database — see
  // src/lib/auth.ts), so it can't tell a genuinely active session from one
  // an admin just force-logged-out or that a password reset just revoked.
  // A protected page's own auth() check (which does hit the database) is
  // what redirects a revoked session here in the first place; bouncing
  // them straight back out again on that same stale edge signal would be
  // an infinite redirect loop between this route and their old dashboard.
  if (isGuestRoute) {
    return NextResponse.next();
  }

  // Handle completely open public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 3. Strict Authentication Guard: Catch unauthenticated traffic trying to access protected apps
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", currentPath);
    return NextResponse.redirect(loginUrl);
  }

  // 4. System Central Switchboard Bypass
  if (currentPath === "/dashboard") {
    return NextResponse.next();
  }

  // 5. RBAC Authorization Firewall
  if (userRole) {
    const accessGranted = isRouteAllowed(currentPath, userRole);

    if (!accessGranted) {
      const targetHomeBase = homeRouteForRole(userRole);
      return NextResponse.redirect(new URL(targetHomeBase, nextUrl));
    }
  } else {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

// src/proxy.ts
export const config = {
  matcher: ["/((?!api/auth|api/cron|api/colleges|_next/static|_next/image|favicon.ico).*)"],
};
