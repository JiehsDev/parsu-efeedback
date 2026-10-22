"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { clientDataCache, CLIENT_DATA_EVENT, type ClientDataChange } from "@/lib/client-fetch";

export function ClientDataBoundary({ scope, children }: { scope: string; children: React.ReactNode }) {
  const router = useRouter();
  useLayoutEffect(() => {
    clientDataCache.setScope(scope);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("parsu-data-changes");
    let timer: ReturnType<typeof setTimeout> | undefined;
    function refresh(change: ClientDataChange) {
      clientDataCache.clear();
      if (change.reason === "logout") {
        window.location.replace("/login");
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 0);
    }
    function local(event: Event) {
      const change = (event as CustomEvent<ClientDataChange>).detail;
      if (change.scope !== scope) return;
      channel?.postMessage(change);
      // Sign-out itself redirects this tab; other tabs must discard their views.
      if (change.reason !== "logout") refresh(change);
    }
    function remote(event: MessageEvent<ClientDataChange>) {
      if (event.data?.scope === scope) refresh(event.data);
    }
    window.addEventListener(CLIENT_DATA_EVENT, local);
    channel?.addEventListener("message", remote);
    return () => {
      window.removeEventListener(CLIENT_DATA_EVENT, local);
      channel?.close();
      clearTimeout(timer);
      clientDataCache.clear();
    };
  }, [scope, router]);
  return children;
}
