import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://parsu.example",
    NODE_ENV: "production",
    RESEND_FROM_EMAIL: "no-reply@parsu.example",
    RESEND_DEV_TEST_EMAIL: "test@parsu.example",
    DEV_TEST_EMAIL_RECIPIENT: undefined,
  },
}));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: mocks.send } },
}));
import { env } from "@/lib/env";
import {
  complaintUrlForRole,
  sendEmailChangeConfirmation,
  sendStudentEmailVerificationEmail,
} from "./email.service";

beforeEach(() => {
  mocks.send.mockReset();
  env.NODE_ENV = "production";
  env.DEV_TEST_EMAIL_RECIPIENT = undefined;
});

describe("complaintUrlForRole", () => {
  it("routes students to the student complaint detail page", () => {
    expect(complaintUrlForRole("abc123", "student")).toBe(
      "https://parsu.example/student/complaints/abc123",
    );
  });

  it("routes office staff to the staff complaint detail page", () => {
    expect(complaintUrlForRole("abc123", "office_staff")).toBe(
      "https://parsu.example/staff/complaints/abc123",
    );
  });

  it("routes administrators and scoped admins to the admin complaint detail page", () => {
    expect(complaintUrlForRole("abc123", "administrator")).toBe(
      "https://parsu.example/admin/complaints/abc123",
    );
    expect(complaintUrlForRole("abc123", "vpaa")).toBe(
      "https://parsu.example/admin/complaints/abc123",
    );
  });
});

describe("sendEmailChangeConfirmation", () => {
  it("sends a confirmation link to the new address", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    await sendEmailChangeConfirmation({
      to: "new@parsu.example",
      recipientName: "Test User",
      confirmationUrl: "https://parsu.example/email-change/token",
    });

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "new@parsu.example" }));
    expect(mocks.send.mock.calls[0]![0].html).toContain("https://parsu.example/email-change/token");
  });

  it("surfaces provider errors so pending confirmation links are invalidated", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: "provider rejected message" } });

    await expect(
      sendEmailChangeConfirmation({
        to: "new@parsu.example",
        recipientName: "Test User",
        confirmationUrl: "https://parsu.example/email-change/token",
      }),
    ).rejects.toThrow("provider rejected message");
  });
});

describe("sendStudentEmailVerificationEmail", () => {
  it("sends the verification code through the configured email provider", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    await sendStudentEmailVerificationEmail({
      to: "student@parsu.edu.ph",
      recipientName: "Test Student",
      code: "482913",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "student@parsu.edu.ph" }),
    );
    expect(mocks.send.mock.calls.at(-1)![0].html).toContain("482913");
  });

  it("fails registration delivery if the provider rejects the verification message", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "provider rejected message" },
    });
    await expect(
      sendStudentEmailVerificationEmail({
        to: "student@parsu.edu.ph",
        recipientName: "Test Student",
        code: "482913",
      }),
    ).rejects.toThrow("provider rejected message");
  });

  it("uses the configured test recipient for non-production email", async () => {
    env.NODE_ENV = "development";
    env.DEV_TEST_EMAIL_RECIPIENT = "recipient@parsu.edu.ph";
    mocks.send.mockResolvedValue({ data: { id: "email-id" }, error: null });

    await sendStudentEmailVerificationEmail({
      to: "student@parsu.edu.ph",
      recipientName: "Test Student",
      code: "482913",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recipient@parsu.edu.ph",
        subject: expect.stringContaining("student@parsu.edu.ph"),
      }),
    );
  });
});
