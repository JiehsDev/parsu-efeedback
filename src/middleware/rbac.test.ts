import { describe, expect, it } from "vitest";
import { homeRouteForRole, isRouteAllowed, requiredRoleForPath } from "./rbac";

describe("rbac route-level scoping", () => {
  it("student routes require student role", () => {
    expect(requiredRoleForPath("/student/dashboard")).toEqual(["student"]);
    expect(isRouteAllowed("/student/dashboard", "student")).toBe(true);
    expect(isRouteAllowed("/student/dashboard", "office_staff")).toBe(false);
  });

  it("staff routes require office_staff role", () => {
    expect(requiredRoleForPath("/staff/dashboard")).toEqual(["office_staff"]);
    expect(isRouteAllowed("/staff/complaints", "office_staff")).toBe(true);
    expect(isRouteAllowed("/staff/complaints", "student")).toBe(false);
  });

  it("admin routes admit administrator and scoped sub-admin roles", () => {
    for (const role of ["administrator", "vpaa", "vpaf", "osas"] as const) {
      expect(isRouteAllowed("/admin/dashboard", role)).toBe(true);
      expect(isRouteAllowed("/api/admin/offices", role)).toBe(true);
    }
  });

  it("administrator remains unrestricted outside admin routes", () => {
    expect(isRouteAllowed("/student/dashboard", "administrator")).toBe(true);
    expect(isRouteAllowed("/staff/complaints", "administrator")).toBe(true);
  });

  it("scoped sub-admin roles cannot access student or staff route prefixes", () => {
    for (const role of ["vpaa", "vpaf", "osas"] as const) {
      expect(isRouteAllowed("/student/dashboard", role)).toBe(false);
      expect(isRouteAllowed("/staff/complaints", role)).toBe(false);
    }
  });

  it("returns each role's correct home route", () => {
    expect(homeRouteForRole("student")).toBe("/student/dashboard");
    expect(homeRouteForRole("office_staff")).toBe("/staff/dashboard");
    expect(homeRouteForRole("administrator")).toBe("/admin/dashboard");
    expect(homeRouteForRole("vpaa")).toBe("/admin/dashboard");
    expect(homeRouteForRole("vpaf")).toBe("/admin/dashboard");
    expect(homeRouteForRole("osas")).toBe("/admin/dashboard");
  });

  it("unscoped paths return null and are open to any authenticated role", () => {
    expect(requiredRoleForPath("/api/complaints")).toBeNull();
    expect(isRouteAllowed("/api/complaints", "student")).toBe(true);
    expect(isRouteAllowed("/api/complaints", "office_staff")).toBe(true);
  });
});
