import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendStudentEmailVerificationEmail: vi.fn() }));

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "development",
    VERCEL_ENV: undefined,
    DEV_EMAIL_REDIRECT_ENABLED: false,
    DEV_SEED_SECRET: "test-secret",
    RESEND_DEV_TEST_EMAIL: "resend-inbox@example.com",
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
    env.NODE_ENV = "development";
    env.VERCEL_ENV = undefined;
    env.DEV_EMAIL_REDIRECT_ENABLED = false;
    env.DEV_SEED_SECRET = "test-secret";
  });

  it("requires the development seed secret", async () => {
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.sendStudentEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends a generated non-account verification code to the configured test inbox", async () => {
    const response = await POST(request("test-secret"));
    expect(response.status).toBe(200);
    expect(mocks.sendStudentEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "resend-inbox@example.com",
        code: expect.stringMatching(/^\d{6}$/),
      }),
    );
    expect(await response.json()).not.toHaveProperty("code");
  });

  it("allows Vercel Preview only when the redirect switch and seed secret are enabled", async () => {
    env.NODE_ENV = "production";
    env.VERCEL_ENV = "preview";
    env.DEV_EMAIL_REDIRECT_ENABLED = true;

    const response = await POST(request("test-secret"));
    expect(response.status).toBe(200);
    expect(mocks.sendStudentEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "resend-inbox@example.com" }),
    );
  });

  it("keeps the test endpoint blocked on Vercel Production", async () => {
    env.NODE_ENV = "production";
    env.VERCEL_ENV = "production";
    env.DEV_EMAIL_REDIRECT_ENABLED = true;

    const response = await POST(request("test-secret"));
    expect(response.status).toBe(403);
    expect(mocks.sendStudentEmailVerificationEmail).not.toHaveBeenCalled();
  });
});
