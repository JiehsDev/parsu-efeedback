import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), seed: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { DEV_SEED_SECRET: "test-seed-secret" } }));
vi.mock("@/lib/db", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/features/seed/seed.service", () => ({ seedDevelopmentData: mocks.seed }));

import { GET, isDevelopmentSeedAuthorized } from "./route";

describe("development seed access", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.seed.mockResolvedValue({ seeded: true });
  });

  it("fails closed when no secret is configured", () => {
    expect(isDevelopmentSeedAuthorized(undefined, null)).toBe(false);
    expect(isDevelopmentSeedAuthorized("", "")).toBe(false);
  });

  it("rejects a missing or incorrect secret without touching the database", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dev/seed"));
    expect(response.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.seed).not.toHaveBeenCalled();
  });

  it("runs the seed only when the configured secret matches", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/dev/seed", {
        headers: { "x-dev-seed-secret": "test-seed-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.seed).toHaveBeenCalledOnce();
  });
});
