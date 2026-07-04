// middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;
  const userRole = req.auth?.user?.role;

  const isPublicRoute = ["/login", "/register", "/forgot-password", "/reset-password"].some(
    (route) => nextUrl.pathname.startsWith(route),
  );

  // 1. If not logged in and trying to hit a protected dashboard route -> kick to login
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 2. If logged in and trying to hit public auth forms -> kick back to their respective home base
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL(`/${userRole}/dashboard`, nextUrl));
  }

  // 3. Strict Role-Based Access Control (BR-084)
  if (isLoggedIn) {
    if (nextUrl.pathname.startsWith("/student") && userRole !== "student") {
      return NextResponse.redirect(new URL("/403", nextUrl)); // Access Denied Response
    }
    if (nextUrl.pathname.startsWith("/staff") && userRole !== "office_staff") {
      return NextResponse.redirect(new URL("/403", nextUrl));
    }
    if (nextUrl.pathname.startsWith("/dean") && userRole !== "college_dean") {
      return NextResponse.redirect(new URL("/403", nextUrl));
    }
    if (nextUrl.pathname.startsWith("/qa") && userRole !== "qa_office") {
      return NextResponse.redirect(new URL("/403", nextUrl));
    }
    if (nextUrl.pathname.startsWith("/admin") && userRole !== "administrator") {
      return NextResponse.redirect(new URL("/403", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
