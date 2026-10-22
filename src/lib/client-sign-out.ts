"use client";

import { signOut } from "next-auth/react";
import { clientDataCache, clearClientDataOnLogout } from "./client-fetch";

export async function signOutWithCacheReset() {
  clientDataCache.clear();
  // Broadcast only after the session cookie is removed, so another tab cannot
  // race back through /login with the session that is being signed out.
  await signOut({ redirect: false, callbackUrl: "/login" });
  clearClientDataOnLogout();
  window.location.assign("/login");
}
