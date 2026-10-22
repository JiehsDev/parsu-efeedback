"use client";

import { createBrowserDataCache, type CacheChange } from "./browser-data-cache";

export const CLIENT_DATA_EVENT = "parsu:data-change";
export const CLIENT_DATA_REFRESH_EVENT = "parsu:data-refresh";
export type ClientDataChange = { reason: CacheChange; scope: string };
export const clientDataCache = createBrowserDataCache({
  fetcher: (input, init) => fetch(input, init),
  origin: () => window.location.origin,
  onChange(reason, scope) {
    window.dispatchEvent(
      new CustomEvent<ClientDataChange>(CLIENT_DATA_EVENT, { detail: { reason, scope } }),
    );
  },
});

export const clientFetch = clientDataCache.fetch;

export function clearClientDataOnLogout() {
  clientDataCache.invalidate("logout");
  clientDataCache.setScope("");
}
