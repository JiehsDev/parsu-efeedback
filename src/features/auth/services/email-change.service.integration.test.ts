import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestUser } from "@/test/fixtures";
import { EmailChangeToken } from "@/models/EmailChangeToken";
import { User } from "@/models/User";

const emailMocks = vi.hoisted(() => ({
  sendConfirmation: vi.fn(),
  sendNotice: vi.fn(),
}));

vi.mock("@/features/notifications/services/email.service", () => ({
  sendEmailChangeConfirmation: emailMocks.sendConfirmation,
  sendEmailChangedNotice: emailMocks.sendNotice,
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));

import { confirmEmailChange, EmailChangeError, requestEmailChange } from "./email-change.service";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  emailMocks.sendConfirmation.mockReset();
  emailMocks.sendNotice.mockReset();
  emailMocks.sendConfirmation.mockResolvedValue(undefined);
  emailMocks.sendNotice.mockResolvedValue(undefined);
});

describe("email-change.service", () => {
  it("requires the current password and leaves the address unchanged until confirmation", async () => {
    const user = await createTestUser({ email: "old-email@test.com" });

    await expect(
      requestEmailChange(String(user._id), "new-email@test.com", "wrong-password"),
    ).rejects.toMatchObject({ code: "invalid_password" });
    expect(await EmailChangeToken.countDocuments()).toBe(0);

    await requestEmailChange(String(user._id), "New-Email@Test.com", "TestPass123!");

    expect((await User.findById(user._id))!.email).toBe("old-email@test.com");
    const tokenRecord = await EmailChangeToken.findOne({ userRef: user._id }).lean();
    expect(tokenRecord!.newEmail).toBe("new-email@test.com");
    expect(tokenRecord!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(emailMocks.sendConfirmation).toHaveBeenCalledOnce();
  });

  it("confirms once, updates the login email, revokes sessions, and notifies the old address", async () => {
    const user = await createTestUser({ email: "old-email@test.com", tokenVersion: 3 });
    await requestEmailChange(String(user._id), "new-email@test.com", "TestPass123!");
    const confirmationUrl = emailMocks.sendConfirmation.mock.calls[0]![0].confirmationUrl;
    const rawToken = confirmationUrl.split("/").at(-1)!;

    await expect(confirmEmailChange(rawToken)).resolves.toMatchObject({
      userId: String(user._id),
      oldEmail: "old-email@test.com",
      newEmail: "new-email@test.com",
    });

    const savedUser = await User.findById(user._id);
    expect(savedUser!.email).toBe("new-email@test.com");
    expect(savedUser!.tokenVersion).toBe(4);
    expect(emailMocks.sendNotice).toHaveBeenCalledWith(
      expect.objectContaining({ to: "old-email@test.com", newEmail: "new-email@test.com" }),
    );
    await expect(confirmEmailChange(rawToken)).rejects.toBeInstanceOf(EmailChangeError);
  });

  it("rejects an email address already owned by another user", async () => {
    const user = await createTestUser({ email: "owner@test.com" });
    await createTestUser({ email: "taken@test.com" });

    await expect(
      requestEmailChange(String(user._id), "taken@test.com", "TestPass123!"),
    ).rejects.toMatchObject({ code: "email_in_use" });
    expect(await EmailChangeToken.countDocuments()).toBe(0);
  });

  it("rejects an address claimed after the confirmation request was sent", async () => {
    const user = await createTestUser({ email: "owner@test.com" });
    await requestEmailChange(String(user._id), "later-taken@test.com", "TestPass123!");
    const rawToken =
      emailMocks.sendConfirmation.mock.calls[0]![0].confirmationUrl.split("/").at(-1)!;
    await createTestUser({ email: "later-taken@test.com" });

    await expect(confirmEmailChange(rawToken)).rejects.toMatchObject({ code: "email_in_use" });
    expect((await User.findById(user._id))!.email).toBe("owner@test.com");
  });

  it("invalidates the confirmation token if the email service fails", async () => {
    const user = await createTestUser({ email: "owner@test.com" });
    emailMocks.sendConfirmation.mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(
      requestEmailChange(String(user._id), "pending@test.com", "TestPass123!"),
    ).rejects.toThrow("provider unavailable");

    const token = await EmailChangeToken.findOne({ userRef: user._id }).lean();
    expect(token!.usedAt).not.toBeNull();
    expect((await User.findById(user._id))!.email).toBe("owner@test.com");
  });

  it("rejects expired confirmation tokens", async () => {
    const user = await createTestUser({ email: "expired@test.com" });
    const rawToken = "d".repeat(64);
    await EmailChangeToken.create({
      userRef: user._id,
      tokenHash: hashToken(rawToken),
      oldEmail: user.email,
      newEmail: "new-expired@test.com",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(confirmEmailChange(rawToken)).rejects.toMatchObject({ code: "invalid_token" });
    expect((await User.findById(user._id))!.email).toBe(user.email);
  });

  it("invalidates earlier pending confirmation links when a newer request is made", async () => {
    const user = await createTestUser({ email: "old-email@test.com" });
    await requestEmailChange(String(user._id), "first@test.com", "TestPass123!");
    const firstToken =
      emailMocks.sendConfirmation.mock.calls[0]![0].confirmationUrl.split("/").at(-1)!;
    await requestEmailChange(String(user._id), "second@test.com", "TestPass123!");

    await expect(confirmEmailChange(firstToken)).rejects.toMatchObject({ code: "invalid_token" });
    expect((await User.findById(user._id))!.email).toBe("old-email@test.com");
  });
});
