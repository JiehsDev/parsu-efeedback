// src/features/complaints/services/status-transitions.service.test.ts
import { describe, it, expect } from "vitest";
import { isValidTransition } from "./status-transitions.service";

describe("status-transitions.service — BR-040/041/043", () => {
  it("BR-041: allows the documented forward lifecycle", () => {
    expect(isValidTransition("submitted", "assigned")).toBe(true);
    expect(isValidTransition("assigned", "in_progress")).toBe(true);
    expect(isValidTransition("in_progress", "pending_information")).toBe(true);
    expect(isValidTransition("in_progress", "resolved")).toBe(true);
    expect(isValidTransition("submitted", "in_progress")).toBe(true);
    expect(isValidTransition("resolved", "closed")).toBe(false);
  });

  it("keeps resolved and closed out of the normal status workflow", () => {
    expect(isValidTransition("resolved", "in_progress")).toBe(false);
    expect(isValidTransition("closed", "in_progress")).toBe(false);
  });

  it("rejects skipping states (e.g. submitted straight to resolved)", () => {
    expect(isValidTransition("submitted", "resolved")).toBe(false);
    expect(isValidTransition("submitted", "closed")).toBe(false);
  });

  it("rejects backward-without-cause transitions", () => {
    expect(isValidTransition("in_progress", "submitted")).toBe(false);
    expect(isValidTransition("closed", "assigned")).toBe(false);
  });

  it("BR-040: rejects a no-op transition to the same status", () => {
    expect(isValidTransition("in_progress", "in_progress")).toBe(false);
  });

  it("keeps escalation out of the generic status workflow", () => {
    expect(isValidTransition("assigned", "escalated")).toBe(false);
    expect(isValidTransition("in_progress", "escalated")).toBe(false);
    expect(isValidTransition("escalated", "in_progress")).toBe(true);
  });

  it("BR-101: allows withdrawing only from submitted, and withdrawn is terminal", () => {
    expect(isValidTransition("submitted", "withdrawn")).toBe(true);
    expect(isValidTransition("assigned", "withdrawn")).toBe(false);
    expect(isValidTransition("in_progress", "withdrawn")).toBe(false);
    expect(isValidTransition("withdrawn", "in_progress")).toBe(false);
    expect(isValidTransition("withdrawn", "submitted")).toBe(false);
  });
});
