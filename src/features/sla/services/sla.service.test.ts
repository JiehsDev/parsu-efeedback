// src/features/sla/services/sla.service.test.ts
import { describe, it, expect } from "vitest";
import { computeSlaDates } from "./sla.service";

describe("sla.service — BR-030/031", () => {
  it("BR-030: computes the response deadline from responseHours", () => {
    const routedAt = new Date("2026-01-01T00:00:00Z");
    const { slaResponseDueAt } = computeSlaDates(routedAt, {
      responseHours: 24,
      resolutionHours: 72,
    });

    expect(slaResponseDueAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  it("BR-031: computes the resolution deadline from resolutionHours", () => {
    const routedAt = new Date("2026-01-01T00:00:00Z");
    const { slaResolutionDueAt } = computeSlaDates(routedAt, {
      responseHours: 24,
      resolutionHours: 72,
    });

    expect(slaResolutionDueAt.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("resolution deadline is always after the response deadline for positive hour configs", () => {
    const routedAt = new Date();
    const { slaResponseDueAt, slaResolutionDueAt } = computeSlaDates(routedAt, {
      responseHours: 12,
      resolutionHours: 48,
    });

    expect(slaResolutionDueAt.getTime()).toBeGreaterThan(slaResponseDueAt.getTime());
  });
});
