import { describe, expect, it, vi } from "vitest";
import { createBrowserDataCache } from "./browser-data-cache";

function setup(options: Partial<Parameters<typeof createBrowserDataCache>[0]> = {}) {
  let clock = 0;
  const fetcher = vi.fn(async () => Response.json({ version: fetcher.mock.calls.length }));
  const onChange = vi.fn();
  const cache = createBrowserDataCache({
    fetcher,
    onChange,
    origin: () => "http://app.test",
    now: () => clock,
    ...options,
  });
  cache.setScope("user-a:staff:osas:1");
  return {
    cache,
    fetcher,
    onChange,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("private browser data cache", () => {
  it("reuses fresh JSON with independent consumable responses and expires after 60 seconds", async () => {
    const { cache, fetcher, advance } = setup();
    expect(await (await cache.fetch("/api/complaints")).json()).toEqual({ version: 1 });
    expect(await (await cache.fetch("/api/complaints")).json()).toEqual({ version: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    advance(60_000);
    expect(await (await cache.fetch("/api/complaints")).json()).toEqual({ version: 2 });
  });

  it("deduplicates simultaneous reads", async () => {
    const { cache, fetcher } = setup();
    const responses = await Promise.all([
      cache.fetch("/api/categories"),
      cache.fetch("/api/categories"),
    ]);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      { version: 1 },
      { version: 1 },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never shares a cached response across identities or access scopes", async () => {
    const { cache, fetcher } = setup();
    await cache.fetch("/api/complaints");
    cache.setScope("user-b:staff:osas:1");
    await cache.fetch("/api/complaints");
    cache.setScope("user-b:staff:other-office:2");
    await cache.fetch("/api/complaints");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("bypasses caching without an authenticated scope", async () => {
    const { cache, fetcher } = setup();
    cache.setScope("");
    await cache.fetch("/api/categories");
    await cache.fetch("/api/categories");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidates reads after a successful mutation and reports the correct scope", async () => {
    const { cache, fetcher, onChange } = setup();
    await cache.fetch("/api/complaints");
    await cache.fetch("/api/complaints/123", { method: "PATCH", body: "{}" });
    await cache.fetch("/api/complaints");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenCalledWith("mutation", "user-a:staff:osas:1");
  });

  it("does not discard valid data after a failed mutation", async () => {
    const { cache, fetcher, onChange } = setup();
    await cache.fetch("/api/complaints");
    fetcher.mockImplementationOnce(async () =>
      Response.json({ error: "Invalid" }, { status: 400 }),
    );
    await cache.fetch("/api/complaints/123", { method: "PATCH" });
    await cache.fetch("/api/complaints");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not cache failures and clears all reads on revoked access", async () => {
    const { cache, fetcher, onChange } = setup();
    await cache.fetch("/api/categories");
    fetcher.mockImplementationOnce(async () =>
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    expect((await cache.fetch("/api/complaints")).status).toBe(403);
    await cache.fetch("/api/categories");
    await cache.fetch("/api/complaints");
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenCalledWith("authorization", "user-a:staff:osas:1");
  });

  it("keeps query and custom-header variants separate", async () => {
    const { cache, fetcher } = setup();
    await cache.fetch("/api/complaints?status=submitted");
    await cache.fetch("/api/complaints?status=closed");
    await cache.fetch("/api/complaints?status=closed", { headers: { "Accept-Language": "fil" } });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("honors explicit refresh and no-store response policies", async () => {
    const { cache, fetcher } = setup();
    await cache.fetch("/api/complaints");
    await cache.fetch("/api/complaints", { cache: "no-store" });
    await cache.fetch("/api/complaints");
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockImplementation(async () =>
      Response.json({ private: true }, { headers: { "Cache-Control": "no-store" } }),
    );
    await cache.fetch("/api/private");
    await cache.fetch("/api/private");
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("never caches session endpoints, downloads, external URLs or abortable reads", async () => {
    const { cache, fetcher } = setup();
    for (const url of [
      "/api/auth/session",
      "/api/me",
      "/api/reports/123/download",
      "https://storage.test/file",
    ]) {
      await cache.fetch(url);
      await cache.fetch(url);
    }
    await cache.fetch("/api/categories", { signal: new AbortController().signal });
    await cache.fetch("/api/categories", { signal: new AbortController().signal });
    expect(fetcher).toHaveBeenCalledTimes(10);
  });

  it("does not repopulate with an old in-flight response after a mutation", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    fetcher.mockImplementation(async () => Response.json({ fresh: true }));
    const { cache } = setup({ fetcher });
    const oldRead = cache.fetch("/api/complaints");
    await cache.fetch("/api/complaints/123", { method: "PATCH" });
    complete(Response.json({ old: true }));
    await oldRead;
    expect(await (await cache.fetch("/api/complaints")).json()).toEqual({ fresh: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("enforces the entry bound using least-recently-used eviction", async () => {
    const { cache, fetcher } = setup({ maxEntries: 2 });
    await cache.fetch("/api/one");
    await cache.fetch("/api/two");
    await cache.fetch("/api/one");
    await cache.fetch("/api/three");
    await cache.fetch("/api/two");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("does not store oversized entries", async () => {
    const fetcher = vi.fn(async () => Response.json({ message: "a".repeat(1000) }));
    const { cache } = setup({ fetcher, maxBytes: 100 });
    await cache.fetch("/api/large");
    await cache.fetch("/api/large");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("preserves binary and empty responses without caching them", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(
      new Response(new Uint8Array([0, 255, 128]), {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { cache } = setup({ fetcher });
    expect([...new Uint8Array(await (await cache.fetch("/api/binary")).arrayBuffer())]).toEqual([
      0, 255, 128,
    ]);
    expect((await cache.fetch("/api/empty")).status).toBe(204);
  });

  it("clears data and broadcasts invalidation before logout", async () => {
    const { cache, fetcher, onChange } = setup();
    await cache.fetch("/api/complaints");
    cache.invalidate("logout");
    cache.setScope("");
    await cache.fetch("/api/complaints");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith("logout", "user-a:staff:osas:1");
  });
});
