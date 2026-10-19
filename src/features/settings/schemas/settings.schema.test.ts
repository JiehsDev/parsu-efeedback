import { describe, expect, it } from "vitest";
import { updateSettingsSchema } from "./settings.schema";

describe("SLA holiday settings", () => {
  it("accepts, deduplicates and sorts calendar dates", () => {
    expect(
      updateSettingsSchema.parse({ slaHolidays: ["2026-12-25", "2026-01-01", "2026-12-25"] })
        .slaHolidays,
    ).toEqual(["2026-01-01", "2026-12-25"]);
  });
  it.each(["2026-02-30", "2026-13-01", "12/25/2026", "2026-12-25T00:00:00Z"])(
    "rejects invalid date %s",
    (value) => {
      expect(updateSettingsSchema.safeParse({ slaHolidays: [value] }).success).toBe(false);
    },
  );
  it("allows clearing holidays or leaving the setting unchanged", () => {
    expect(updateSettingsSchema.parse({ slaHolidays: [] }).slaHolidays).toEqual([]);
    expect(updateSettingsSchema.parse({}).slaHolidays).toBeUndefined();
  });
});
