import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://parsu.example" },
}));
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
}));

import { complaintUrlForRole } from "./email.service";

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
