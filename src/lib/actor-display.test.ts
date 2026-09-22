import { describe, expect, it } from "vitest";
import { getActorDisplayName } from "./actor-display";

describe("complaint actor privacy display", () => {
  it("uses a student ID instead of a student's name for handlers", () => {
    expect(getActorDisplayName({ role: "student", firstName: "Elliot", lastName: "Anderson", employeeOrStudentId: "2024-20024" })).toBe("Student · 2024-20024");
  });

  it("falls back to Student when the student ID is unavailable", () => {
    expect(getActorDisplayName({ role: "student", firstName: "Elliot", lastName: "Anderson" })).toBe("Student");
  });

  it("keeps staff actor names visible", () => {
    expect(getActorDisplayName({ role: "office_staff", firstName: "Maria", lastName: "Santos" })).toBe("Maria Santos");
  });

  it("allows a student to see their own name in their own view", () => {
    expect(getActorDisplayName({ role: "student", firstName: "Elliot", lastName: "Anderson", employeeOrStudentId: "2024-20024" }, "student")).toBe("Elliot Anderson");
  });
});
