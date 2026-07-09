// src/features/auth/actions/logout.action.ts
"use server";

import { signOut } from "@/lib/auth";

/**
 * Destroys the current user session cookie and triggers a server-side redirect.
 * Because it's a Server Action, it seamlessly handles cookie purging.
 */
export async function logoutAction() {
  await signOut({
    redirectTo: "/login",
    redirect: true,
  });
}