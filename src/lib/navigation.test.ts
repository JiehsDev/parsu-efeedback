import { expect, it } from "vitest";
import { isNavigationItemActive } from "./navigation";

it("selects the archived view instead of the complaints root", () => {
  const links = ["/admin/complaints", "/admin/complaints?archived=1"];
  expect(
    links.filter((href) => isNavigationItemActive("/admin/complaints", "archived=1", href, links)),
  ).toEqual([links[1]]);
  expect(
    links.filter((href) =>
      isNavigationItemActive("/admin/complaints", "q=scholarship", href, links),
    ),
  ).toEqual([links[0]]);
});
it("selects one destination for nested submission and archived pages", () => {
  for (const [pathname, links] of [
    ["/student/complaints/new", ["/student/complaints", "/student/complaints/new"]],
    ["/staff/complaints/archived", ["/staff/complaints", "/staff/complaints/archived"]],
  ] as const) {
    expect(links.filter((href) => isNavigationItemActive(pathname, "", href, [...links]))).toEqual([
      links[1],
    ]);
  }
});
it("does not match similarly named pages", () => {
  expect(
    isNavigationItemActive("/staff/complaints-other", "", "/staff/complaints", [
      "/staff/complaints",
    ]),
  ).toBe(false);
});
