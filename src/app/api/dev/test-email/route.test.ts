import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendStudentEmailVerificationEmail: vi.fn() }));

vi.mock("@/lib/env", () => ({
  env: {
    DEV_SEED_SECRET: "test-secret",
    DEV_TEST_EMAIL_RECIPIENT: "recipient@parsu.edu.ph",
  },
}));
vi.mock("@/features/notifications/services/email.service", () => ({
  sendStudentEmailVerificationEmail: mocks.sendStudentEmailVerificationEmail,
}));

import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { POST } from "./route";

function request(secret?: string) {
  return new NextRequest("http://localhost/api/dev/test-email", {
    method: "POST",
    headers: secret ? { "x-dev-seed-secret": secret } : {},
  });
}

describe("POST /api/dev/test-email", () => {
  beforeEach(() => {
    mocks.sendStudentEmailVerificationEmail.mockReset().mockResolvedValue(undefined);
    env.DEV_SEED_SECRET = "test-secret";
    env.DEV_TEST_EMAIL_RECIPIENT = "recipient@parsu.edu.ph";
  });

  it("requires the development seed secret", async () => {
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.sendStudentEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("requires an explicitly configured test recipient", async () => {
    env.DEV_TEST_EMAIL_RECIPIENT = undefined;
    const response = await POST(request("test-secret"));
    expect(response.status).toBe(503);
    expect(mocks.sendStudentEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends a generated non-account verification code to the configured test inbox", async () => {
    const response = await POST(request("test-secret"));
    expect(response.status).toBe(200);
    expect(mocks.sendStudentEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recipient@parsu.edu.ph",
        code: expect.stringMatching(/^\d{6}$/),
      }),
    );
    expect(await response.json()).not.toHaveProperty("code");
  });
});
