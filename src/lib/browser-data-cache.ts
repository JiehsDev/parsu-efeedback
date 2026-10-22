// Private, bounded browser-memory cache. Never persist complaint data on disk.
type Snapshot = {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
};
type Entry = { value: Snapshot; expires: number; bytes: number };
export type CacheChange = "mutation" | "authorization" | "logout";

export function createBrowserDataCache({
  fetcher,
  origin,
  now = Date.now,
  ttl = 60_000,
  maxEntries = 80,
  maxBytes = 8 * 1024 * 1024,
  onChange,
}: {
  fetcher: typeof fetch;
  origin: () => string;
  now?: () => number;
  ttl?: number;
  maxEntries?: number;
  maxBytes?: number;
  onChange?: (reason: CacheChange, scope: string) => void;
}) {
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Promise<Snapshot>>();
  let scope = "";
  let generation = 0;
  let bytes = 0;
  function clear() {
    entries.clear();
    pending.clear();
    bytes = 0;
    generation++;
  }
  function invalidate(reason: CacheChange) {
    clear();
    onChange?.(reason, scope);
  }
  function remove(key: string) {
    const entry = entries.get(key);
    if (entry) bytes -= entry.bytes;
    entries.delete(key);
  }
  function response(value: Snapshot) {
    return new Response([204, 205, 304].includes(value.status) ? null : value.body, {
      status: value.status,
      statusText: value.statusText,
      headers: value.headers,
    });
  }
  async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : String(input), origin());
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const localApi = url.origin === origin() && url.pathname.startsWith("/api/");
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    // Auth, binary/signed downloads, explicit refreshes, and custom requests stay live.
    const canCache =
      scope &&
      localApi &&
      method === "GET" &&
      !(input instanceof Request) &&
      !init?.signal &&
      !headers.has("authorization") &&
      !headers.has("range") &&
      !["no-store", "reload", "no-cache"].includes(init?.cache ?? "") &&
      !/^\/api\/(auth|dev|uploads|me)(\/|$)/.test(url.pathname) &&
      !/\/(download|print)$/.test(url.pathname);
    if (!canCache) {
      // Explicit refreshes must also discard the older entry.
      if (
        localApi &&
        method === "GET" &&
        ["no-store", "reload", "no-cache"].includes(init?.cache ?? "")
      )
        clear();
      const result = await fetcher(
        input,
        localApi && method === "GET" ? { ...init, cache: "no-store" } : init,
      );
      if (localApi && [401, 403].includes(result.status)) invalidate("authorization");
      else if (localApi && result.ok && !["GET", "HEAD", "OPTIONS"].includes(method))
        invalidate("mutation");
      return result;
    }
    const key = `${url.href}:${JSON.stringify([...headers.entries()].sort())}:${init?.credentials ?? "same-origin"}`;
    const existing = entries.get(key);
    if (existing && existing.expires > now()) {
      entries.delete(key);
      entries.set(key, existing);
      return response(existing.value);
    }
    remove(key);
    const inFlight = pending.get(key);
    if (inFlight) return response(await inFlight);
    const started = generation;
    const task = (async () => {
      // Use our scoped memory cache, rather than the browser's persistent HTTP cache.
      const result = await fetcher(input, { ...init, cache: "no-store" });
      if ([401, 403].includes(result.status)) invalidate("authorization");
      const value: Snapshot = {
        body: await result.arrayBuffer(),
        status: result.status,
        statusText: result.statusText,
        headers: [...result.headers.entries()],
      };
      const size = value.body.byteLength;
      if (
        started === generation &&
        result.ok &&
        !result.redirected &&
        result.headers.get("content-type")?.includes("application/json") &&
        !/no-store/i.test(result.headers.get("cache-control") ?? "") &&
        size <= 512 * 1024 &&
        size <= maxBytes
      ) {
        while (entries.size && (entries.size >= maxEntries || bytes + size > maxBytes))
          remove(entries.keys().next().value!);
        entries.set(key, { value, expires: now() + ttl, bytes: size });
        bytes += size;
      }
      return value;
    })();
    pending.set(key, task);
    try {
      return response(await task);
    } finally {
      if (pending.get(key) === task) pending.delete(key);
    }
  }
  return {
    fetch: request,
    clear,
    invalidate,
    setScope(value: string) {
      if (value !== scope) {
        clear();
        scope = value;
      }
    },
  };
}
