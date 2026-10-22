"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clientDataCache,
  CLIENT_DATA_EVENT,
  CLIENT_DATA_REFRESH_EVENT,
  type ClientDataChange,
} from "@/lib/client-fetch";

export function ClientDataBoundary({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  useLayoutEffect(() => {
    clientDataCache.setScope(scope);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel("parsu-data-changes");
    } catch {
      // Browser privacy settings may block cross-tab messaging; local caching still works.
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    function refresh(change: ClientDataChange) {
      clientDataCache.clear();
      if (change.reason === "logout") {
        window.location.replace("/login");
        return;
      }
      window.dispatchEvent(new Event(CLIENT_DATA_REFRESH_EVENT));
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
      clientDataCache.setScope("");
    };
  }, [scope, router]);
  return children;
}
