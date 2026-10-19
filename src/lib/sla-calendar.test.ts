import { describe, expect, it } from "vitest";
import { addSlaHours, eligibleElapsedMs, elapsedSlaMs, slaElapsedPercent } from "./sla-calendar";

const date = (value: string) => new Date(value + "+08:00");
describe("Philippine SLA calendar", () => {
  it("counts weekday nights as working time", () => {
    expect(addSlaHours(date("2026-10-23T15:00:00"), 8)).toEqual(date("2026-10-23T23:00:00"));
  });
  it("carries Friday time across the weekend", () => {
    expect(addSlaHours(date("2026-10-23T18:00:00"), 10)).toEqual(date("2026-10-26T04:00:00"));
  });
  it.each(["2026-10-24T10:00:00", "2026-10-25T20:00:00"])(
    "starts weekend submissions on Monday",
    (start) => {
      expect(addSlaHours(date(start), 4)).toEqual(date("2026-10-26T04:00:00"));
    },
  );
  it("skips consecutive holidays and ignores duplicate/weekend holiday entries", () => {
    const holidays = ["2026-10-26", "2026-10-27", "2026-10-24", "2026-10-26"];
    expect(addSlaHours(date("2026-10-23T18:00:00"), 10, holidays)).toEqual(
      date("2026-10-28T04:00:00"),
    );
    expect(addSlaHours(date("2026-10-26T10:00:00"), 4, holidays)).toEqual(
      date("2026-10-28T04:00:00"),
    );
  });
  it("normalizes an exact weekend boundary to the next eligible midnight", () => {
    expect(addSlaHours(date("2026-10-23T18:00:00"), 6)).toEqual(date("2026-10-26T00:00:00"));
  });
  it("handles year boundaries and fractional hours", () => {
    expect(addSlaHours(date("2026-12-31T23:30:00"), 1, ["2027-01-01"])).toEqual(
      date("2027-01-04T00:30:00"),
    );
    expect(addSlaHours(date("2026-10-23T23:45:00"), 0.5)).toEqual(date("2026-10-26T00:15:00"));
  });
  it("uses Philippine midnight even when the UTC date is still Friday", () => {
    expect(addSlaHours(new Date("2026-10-23T17:00:00Z"), 1)).toEqual(date("2026-10-26T01:00:00"));
  });
  it("pauses elapsed duration during excluded dates", () => {
    const start = date("2026-10-23T18:00:00");
    expect(eligibleElapsedMs(start, date("2026-10-25T23:00:00"))).toBe(6 * 3_600_000);
    expect(eligibleElapsedMs(start, date("2026-10-27T04:00:00"), ["2026-10-26"])).toBe(
      10 * 3_600_000,
    );
    expect(eligibleElapsedMs(start, new Date(start.getTime() - 1))).toBe(0);
  });
  it("preserves calendar durations for historical complaints without a policy", () => {
    expect(elapsedSlaMs(date("2026-10-23T18:00:00"), date("2026-10-26T04:00:00"))).toBe(
      58 * 3_600_000,
    );
  });
  it("bases warnings on eligible elapsed hours, independently of current rule changes", () => {
    const policy = {
      version: 1,
      holidays: [],
      startedAt: date("2026-10-23T18:00:00"),
      responseHours: 10,
      resolutionHours: 10,
      warningThresholdPercent: 80,
    };
    const due = addSlaHours(new Date(policy.startedAt), 10);
    expect(slaElapsedPercent(date("2026-10-25T23:00:00"), due, "response", 1, policy)).toBe(60);
    expect(slaElapsedPercent(date("2026-10-26T02:00:00"), due, "resolution", 1, policy)).toBe(80);
  });
  it("rejects invalid hours and dates", () => {
    expect(() => addSlaHours(new Date(), Infinity)).toThrow();
    expect(() => addSlaHours(new Date("invalid"), 1)).toThrow();
  });
});
