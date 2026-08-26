// src/middleware/rbac.test.ts
import { describe, it, expect } from "vitest";
import { requiredRoleForPath, isRouteAllowed, homeRouteForRole } from "./rbac";

describe("rbac — BR-091-096 route-level scoping", () => {
  it("BR-092: student routes require student role", () => {
    expect(requiredRoleForPath("/student/dashboard")).toBe("student");
    expect(isRouteAllowed("/student/dashboard", "student")).toBe(true);
    expect(isRouteAllowed("/student/dashboard", "office_staff")).toBe(false);
  });

  it("BR-093: staff routes require office_staff role", () => {
    expect(isRouteAllowed("/staff/complaints", "office_staff")).toBe(true);
    expect(isRouteAllowed("/staff/complaints", "student")).toBe(false);
  });

  it("BR-094: dean routes require college_dean role", () => {
    expect(isRouteAllowed("/dean/dashboard", "college_dean")).toBe(true);
    expect(isRouteAllowed("/dean/dashboard", "qa_office")).toBe(false);
  });

  it("BR-095: qa routes require qa_office role", () => {
    expect(isRouteAllowed("/qa/analytics", "qa_office")).toBe(true);
    expect(isRouteAllowed("/qa/analytics", "office_staff")).toBe(false);
  });

  it("BR-096/BR-010: admin routes require administrator role, and administrator is unrestricted everywhere", () => {
    expect(isRouteAllowed("/admin/users", "administrator")).toBe(true);
    expect(isRouteAllowed("/admin/users", "qa_office")).toBe(false);
    // BR-010: admin's access isn't limited to /admin/** — it's every route.
    expect(isRouteAllowed("/student/dashboard", "administrator")).toBe(true);
    expect(isRouteAllowed("/staff/complaints", "administrator")).toBe(true);
    expect(isRouteAllowed("/dean/dashboard", "administrator")).toBe(true);
    expect(isRouteAllowed("/qa/analytics", "administrator")).toBe(true);
  });

  it("returns each role's correct home route", () => {
    expect(homeRouteForRole("student")).toBe("/student/dashboard");
    expect(homeRouteForRole("office_staff")).toBe("/staff/dashboard");
    expect(homeRouteForRole("college_dean")).toBe("/dean/dashboard");
    expect(homeRouteForRole("qa_office")).toBe("/qa/dashboard");
    expect(homeRouteForRole("administrator")).toBe("/admin/dashboard");
  });

  it("unscoped paths (e.g. shared API routes) return null and are open to any authenticated role", () => {
    expect(requiredRoleForPath("/api/complaints")).toBeNull();
    expect(isRouteAllowed("/api/complaints", "student")).toBe(true);
    expect(isRouteAllowed("/api/complaints", "qa_office")).toBe(true);
  });
});
