// src/features/notifications/notifications.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Notification } from "@/models/Notification";
import { createTestUser } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Notifications — BR-071/072/073/074", () => {
  it("BR-071/072: a user may receive multiple notifications", async () => {
    const user = await createTestUser();
    await Notification.create({
      userRef: user._id,
      type: "complaint_submitted",
      title: "Submitted",
      body: "Your complaint was submitted",
    });
    await Notification.create({
      userRef: user._id,
      type: "status_updated",
      title: "Updated",
      body: "Your complaint status changed",
    });

    const notifications = await Notification.find({ userRef: user._id });
    expect(notifications).toHaveLength(2);
  });

  it("BR-073: notifications default to unread, and can be marked read", async () => {
    const user = await createTestUser();
    const notification = await Notification.create({
      userRef: user._id,
      type: "sla_warning",
      title: "Warning",
      body: "SLA approaching",
    });

    expect(notification.isRead).toBe(false);

    notification.isRead = true;
    await notification.save();

    const updated = await Notification.findById(notification._id);
    expect(updated!.isRead).toBe(true);
  });

  it("BR-074: type field only accepts the documented system-generated event types", async () => {
    const user = await createTestUser();

    await expect(
      Notification.create({
        userRef: user._id,
        type: "not_a_real_type",
        title: "Bad",
        body: "This should fail",
      }),
    ).rejects.toThrow();
  });

  it("all six documented notification types are valid", async () => {
    const user = await createTestUser();
    const types = [
      "complaint_submitted",
      "complaint_assigned",
      "status_updated",
      "sla_warning",
      "complaint_resolved",
      "report_generated",
    ];

    for (const type of types) {
      await expect(
        Notification.create({ userRef: user._id, type, title: "T", body: "B" }),
      ).resolves.toBeTruthy();
    }
  });
});
