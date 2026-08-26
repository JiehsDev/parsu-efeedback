// src/features/auth/services/auth.service.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser } from "@/test/fixtures";
import { env } from "@/lib/env";
import { User } from "@/models/User";
import {
  authenticateUser,
  AccountInactiveError,
  AccountLockedError,
  InvalidCredentialsError,
} from "./auth.service";

// env.ts (src/lib/env.ts) lazily validates the FULL process.env against its
// Zod schema on first property access, throwing if anything required is
// missing. Under `npx vitest run` in this sandbox, .env.local is not
// auto-loaded into process.env (unlike `next dev`), so authenticateUser's
// lockout branch (the first code path in this file to touch env.*) would
// throw a config error rather than exercising BR-013 — a test-harness gap,
// not an application bug. Stub the full required shape (values mirror
// .env.local's placeholders, before any test body runs) so env.ts
// validates and the real AUTH_MAX_FAILED_LOGIN_ATTEMPTS /
// AUTH_LOCKOUT_DURATION_MINUTES defaults (5 / 15, per src/lib/env.ts) are
// what's actually exercised below.
beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("MONGODB_URI", "mongodb://stub-not-used-mongoose-already-connected");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-stub-value");
  vi.stubEnv("AUTH_URL", "http://localhost:3000/api/auth");
  vi.stubEnv("R2_ACCOUNT_ID", "stub-account-id");
  vi.stubEnv("R2_ACCESS_KEY_ID", "stub-access-key-id");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "stub-secret-access-key");
  vi.stubEnv("R2_BUCKET_NAME", "stub-bucket");
  vi.stubEnv("R2_PUBLIC_URL", "https://stub.example.com");
  vi.stubEnv("RESEND_API_KEY", "stub-resend-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "stub@example.com");
  vi.stubEnv("RESEND_DEV_TEST_EMAIL", "stub-dev@example.com");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://stub-redis.example.com");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "stub-redis-token");
  vi.stubEnv("CRON_SECRET", "stub-cron-secret-at-least-16-chars");
});

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("authenticateUser — BR-005/012/013", () => {
  it("BR-013: locks the account after AUTH_MAX_FAILED_LOGIN_ATTEMPTS consecutive failures", async () => {
    const user = await createTestUser({ email: "lockout@test.com", role: "student" });

    for (let i = 0; i < env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
      await expect(authenticateUser(user.email, "WrongPassword!")).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    // The Nth failure trips the lock AND reports it immediately — the
    // triggering attempt itself throws AccountLockedError, not a generic
    // InvalidCredentialsError, so the user isn't left thinking it was just
    // a typo and retrying against an already-locked account.
    await expect(authenticateUser(user.email, "WrongPassword!")).rejects.toThrow(
      AccountLockedError,
    );

    const saved = await User.findById(user._id);
    expect(saved!.failedLoginAttempts).toBe(0); // reset once locked
    expect(saved!.lockedUntil).not.toBeNull();
    expect(saved!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("BR-013: lockedUntil is respected on a subsequent attempt even with the correct password", async () => {
    const user = await createTestUser({ email: "locked-correct@test.com", role: "student" });
    await User.updateOne(
      { _id: user._id },
      { lockedUntil: new Date(Date.now() + 15 * 60_000) },
    );

    await expect(authenticateUser(user.email, "TestPass123!")).rejects.toThrow(
      AccountLockedError,
    );
  });

  it("BR-013: a lockedUntil in the past no longer blocks authentication", async () => {
    const user = await createTestUser({ email: "expired-lock@test.com", role: "student" });
    await User.updateOne({ _id: user._id }, { lockedUntil: new Date(Date.now() - 60_000) });

    const result = await authenticateUser(user.email, "TestPass123!");
    expect(result.email).toBe("expired-lock@test.com");
  });

  it("BR-005: an inactive account is rejected even with the correct password", async () => {
    const user = await createTestUser({
      email: "inactive@test.com",
      role: "student",
      isActive: false,
    });

    await expect(authenticateUser(user.email, "TestPass123!")).rejects.toThrow(
      AccountInactiveError,
    );
  });

  it("BR-012: lastLoginAt is updated on every successful authentication", async () => {
    const user = await createTestUser({ email: "lastlogin@test.com", role: "student" });
    expect(user.lastLoginAt).toBeNull();

    const before = Date.now();
    await authenticateUser(user.email, "TestPass123!");

    const saved = await User.findById(user._id);
    expect(saved!.lastLoginAt).not.toBeNull();
    expect(saved!.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("BR-012/013: a successful login clears failedLoginAttempts and lockedUntil", async () => {
    const user = await createTestUser({ email: "clear-on-success@test.com", role: "student" });
    await User.updateOne(
      { _id: user._id },
      { failedLoginAttempts: 2, lockedUntil: null },
    );

    await authenticateUser(user.email, "TestPass123!");

    const saved = await User.findById(user._id);
    expect(saved!.failedLoginAttempts).toBe(0);
    expect(saved!.lockedUntil).toBeNull();
  });

  it("gives the same generic error for a nonexistent email and a wrong password (no enumeration)", async () => {
    const user = await createTestUser({ email: "exists@test.com", role: "student" });

    let nonexistentError: unknown;
    let wrongPasswordError: unknown;
    try {
      await authenticateUser("does-not-exist@test.com", "whatever");
    } catch (error) {
      nonexistentError = error;
    }
    try {
      await authenticateUser(user.email, "WrongPassword!");
    } catch (error) {
      wrongPasswordError = error;
    }

    expect(nonexistentError).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsError);
    expect((nonexistentError as Error).message).toBe((wrongPasswordError as Error).message);
  });
});
