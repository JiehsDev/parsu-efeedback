import { describe, expect, it } from "vitest";
import { sessionAuthorizationClaimsMatch } from "./session-authorization";

const claims = { role: "office_staff", officeRef: "office-1", collegeRef: null };

describe("sessionAuthorizationClaimsMatch", () => {
  it("accepts a session whose authorization claims still match the user", () => {
    expect(
      sessionAuthorizationClaimsMatch(
        { role: "office_staff", officeRef: "office-1", collegeRef: null },
        claims,
      ),
    ).toBe(true);
  });

  it.each([
    [{ role: "administrator", officeRef: "office-1", collegeRef: null }],
    [{ role: "office_staff", officeRef: "office-2", collegeRef: null }],
    [{ role: "office_staff", officeRef: "office-1", collegeRef: "college-1" }],
  ])("rejects stale authorization claims: %o", (user) => {
    expect(sessionAuthorizationClaimsMatch(user, claims)).toBe(false);
  });
});
