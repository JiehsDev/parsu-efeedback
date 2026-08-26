// src/models/complaint-timeline.integration.test.ts
// BR-054/055/056 — model-level only. BR-053 (an entry per significant
// action across 6+ endpoints) is cross-cutting and proven per-endpoint by
// the E2E suite, not by one Vitest test. BR-057 (immutability) is
// convention-only (no schema-level lock — see the model file's own
// comment), so it is noted, not asserted, here.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function baseComplaint() {
  const { category, office } = await createActivatableCategory();
  const student = await createTestUser({ role: "student" });
  const complaint = await Complaint.create({
    ticketNumber: `TEST-${Date.now()}`,
    studentRef: student._id,
    categoryRef: category._id,
    title: "Test complaint",
    description: "Test description long enough to pass validation",
    priority: "medium",
    status: "submitted",
    assignedOfficeRef: office._id,
  });
  return { complaint, student };
}

describe("ComplaintTimeline model — BR-054/055/056", () => {
  it("BR-056: eventType is restricted to the defined fixed set — rejects an invalid value", async () => {
    const { complaint } = await baseComplaint();

    await expect(
      ComplaintTimeline.create({
        complaintRef: complaint._id,
        eventType: "not_a_real_event",
        actorRef: null,
      } as any),
    ).rejects.toThrow();
  });

  it("BR-056: accepts every documented event type", async () => {
    const { complaint } = await baseComplaint();
    const record = await ComplaintTimeline.create({
      complaintRef: complaint._id,
      eventType: "status_changed",
      actorRef: null,
    });
    expect(record.eventType).toBe("status_changed");
  });

  it("BR-055: actorRef: null is valid, marking a system-generated entry", async () => {
    const { complaint } = await baseComplaint();
    const record = await ComplaintTimeline.create({
      complaintRef: complaint._id,
      eventType: "submitted",
      actorRef: null,
    });
    expect(record.actorRef).toBeNull();
  });

  it("BR-055: actorRef records the acting user when the event was human-initiated", async () => {
    const { complaint, student } = await baseComplaint();
    const record = await ComplaintTimeline.create({
      complaintRef: complaint._id,
      eventType: "note_added",
      actorRef: student._id,
    });
    expect(String(record.actorRef)).toBe(String(student._id));
  });

  it("BR-054: records the event type alongside optional fromValue/toValue for state transitions", async () => {
    const { complaint } = await baseComplaint();
    const record = await ComplaintTimeline.create({
      complaintRef: complaint._id,
      eventType: "status_changed",
      actorRef: null,
      fromValue: "submitted",
      toValue: "assigned",
    });
    expect(record.fromValue).toBe("submitted");
    expect(record.toValue).toBe("assigned");
  });

  // BR-057 (immutability once created) has no schema-level enforcement —
  // per the model file's own comment, it relies on the repository layer
  // never calling update/delete. Not asserted here since there is nothing
  // to assert against without writing a fake pass.
});
