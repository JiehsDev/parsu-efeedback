# Device-side caching

Visited application pages use a 60-second Next.js client-router cache. Browser API reads use a separate 60-second memory cache, shared by the client components in the current browser tab. Initial visits, expired entries, explicit reloads, writes, authentication, and downloads still contact the server.

The dashboard keeps its existing layout but reads `/api/dashboard` through this cache. The endpoint authenticates the session and reuses the existing OSAS office-membership and oversight query filters. Neither dashboard data nor API responses are put into a shared server cache. Next.js can still request a small dashboard route payload in development; its dashboard data does not need to be fetched again while fresh.

## Privacy and freshness

- Scope includes user ID, role, office, college, and token version. Changing scope clears memory and remounts the protected client subtree.
- Complaint data is not written to local storage, IndexedDB, or a service worker. Native API fetches bypass the persistent HTTP cache.
- Simultaneous identical reads share one request; response bodies remain independently consumable.
- Successful API mutations invalidate cached reads and refresh server-rendered views. The dashboard also reloads its client data. Same-user browser tabs receive an invalidation message containing scope metadata only.
- Sign-out clears local data immediately and broadcasts logout after the session cookie is removed. Other same-user tabs discard their data and go to sign-in.
- Authorization failures clear the cache. Writes always use live authenticated API requests; cache hits do not authorize operations.
- Auth/session/profile endpoints, external uploads, signed/binary downloads, caller-abortable requests, failures, and explicit no-store reads are not cached. Response no-store directives are honored.
- The memory cache is bounded to 80 entries / 8 MiB, with a 512 KiB limit per entry and least-recently-used eviction. Invalidated in-flight reads cannot repopulate the cache with an older result.

## Checks

44 targeted tests cover memory-cache behavior, sign-out ordering, dashboard endpoint authorization, and theme regressions. TypeScript and lint checks cover the updated browser components and layouts. Browser checks measure dashboard/queue/report revisits, cache invalidation after a simulated successful mutation, and office-wide staff dashboard scope against the running development database.

The cache expires on demand: another user's new complaint may appear up to 60 seconds later when revisiting a page. A full browser refresh requests current data immediately. Browser tabs do not share cached complaint bodies.

The installed Next.js 16.2.10 router-cache configuration uses its experimental `staleTimes` option. See the [Next.js reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes). This does not enable the server-side Turbopack disk cache.
