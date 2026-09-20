import { describe, expect, it } from "vitest";
import { actionLabel, formatEnumLabel, statusLabel } from "@/lib/display-labels";

describe("display labels", () => {
  it("turns internal action values into readable labels", () => {
    expect(formatEnumLabel("manual_escalation")).toBe("Manual Escalation");
    expect(formatEnumLabel("user.update")).toBe("User Update");
    expect(actionLabel("user.update")).toBe("User Updated");
  });

  it("keeps complaint status labels consistent", () => {
    expect(statusLabel("in_progress")).toBe("In Progress");
    expect(statusLabel("pending_information")).toBe("Pending Information");
  });
});
