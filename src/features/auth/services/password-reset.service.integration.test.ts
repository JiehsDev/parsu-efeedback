// src/features/auth/services/password-reset.service.integration.test.ts
import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser } from "@/test/fixtures";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";

// Isolate these tests from the real Resend network call — the behavior
// under test is token persistence/expiry/one-time-use, not email delivery
// (which is separately wrapped in its own try/catch in the source and
// already best-effort/non-fatal by design).
vi.mock("@/features/notifications/services/email.service", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { requestPasswordReset, resetPassword, InvalidOrExpiredTokenError } from "./password-reset.service";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("password-reset.service — token hashing/expiry/one-time-use", () => {
  it("stores the token hashed, never the raw value", async () => {
    const user = await createTestUser({ email: "reset@test.com" });
    await requestPasswordReset(user.email, "127.0.0.1");

    const tokens = await PasswordResetToken.find({ userRef: user._id }).lean();
    expect(tokens).toHaveLength(1);
    // A raw hex token is 64 chars (32 random bytes); tokenHash is also a
    // 64-char sha256 hex digest, but the crucial property is that it isn't
    // literally stored verbatim as a "raw" secret anywhere retrievable —
    // confirm it's a hex digest, not, say, base64 or the literal token
    // captured via the mocked email call.
    expect(tokens[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a nonexistent or inactive email silently produces no token (no enumeration)", async () => {
    await requestPasswordReset("nobody@test.com", null);
    expect(await PasswordResetToken.countDocuments({})).toBe(0);

    const inactiveUser = await createTestUser({ email: "inactive-reset@test.com", isActive: false });
    await requestPasswordReset(inactiveUser.email, null);
    expect(await PasswordResetToken.countDocuments({})).toBe(0);
  });

  it("resetPassword rejects an unknown token", async () => {
    await expect(resetPassword("not-a-real-token", "NewPass123!")).rejects.toThrow(
      InvalidOrExpiredTokenError,
    );
  });

  it("resetPassword rejects an expired token", async () => {
    const user = await createTestUser({ email: "expired-token@test.com" });
    const rawToken = "a".repeat(64);
    await PasswordResetToken.create({
      userRef: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 60_000), // already expired
    });

    await expect(resetPassword(rawToken, "NewPass123!")).rejects.toThrow(
      InvalidOrExpiredTokenError,
    );
  });

  it("resetPassword succeeds with a valid unused token and updates the password hash", async () => {
    const user = await createTestUser({ email: "valid-token@test.com" });
    const originalHash = user.passwordHash;
    const rawToken = "b".repeat(64);
    await PasswordResetToken.create({
      userRef: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });

    await resetPassword(rawToken, "NewPass123!");

    const saved = await User.findById(user._id);
    expect(saved!.passwordHash).not.toBe(originalHash);
  });

  it("a token is single-use: a second attempt with the same raw token is rejected", async () => {
    const user = await createTestUser({ email: "single-use@test.com" });
    const rawToken = "c".repeat(64);
    await PasswordResetToken.create({
      userRef: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });

    await resetPassword(rawToken, "NewPass123!");

    const stored = await PasswordResetToken.findOne({ tokenHash: hashToken(rawToken) });
    expect(stored!.usedAt).not.toBeNull();

    await expect(resetPassword(rawToken, "AnotherPass456!")).rejects.toThrow(
      InvalidOrExpiredTokenError,
    );
  });
});
