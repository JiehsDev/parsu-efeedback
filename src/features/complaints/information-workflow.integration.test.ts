import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createActivatableCategory, createTestUser } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { InformationRequest } from "@/models/InformationRequest";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { Attachment } from "@/models/Attachment";
import { Notification } from "@/models/Notification";
import { informationRequestSchema, informationResponseSchema } from "@/features/complaints/schemas/complaint.schema";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Pending information workflow", () => {
  async function setup() {
    const { category, office } = await createActivatableCategory();
    const student = await createTestUser({ role: "student" });
    const staff = await createTestUser({ role: "office_staff", officeRef: office._id });
    const complaint = await Complaint.create({
      ticketNumber: `TEST-INFO-${Date.now()}`,
      studentRef: student._id,
      categoryRef: category._id,
      title: "Information workflow complaint",
      description: "A complaint with enough description for the workflow test.",
      priority: "medium",
      status: "in_progress",
      assignedOfficeRef: office._id,
      assignedStaffRef: staff._id,
    });
    return { complaint, student, staff };
  }

  it("requires a request message and response message", () => {
    expect(informationRequestSchema.safeParse({ requestMessage: "" }).success).toBe(false);
    expect(informationResponseSchema.safeParse({ responseMessage: "" }).success).toBe(false);
  });

  it("preserves request, response, attachment, timeline, and notification history across cycles", async () => {
    const { complaint, student, staff } = await setup();
    const request = await InformationRequest.create({
      complaintRef: complaint._id,
      requestedByRef: staff._id,
      requestMessage: "Please upload a clearer copy of your receipt.",
      status: "open",
    });
    complaint.status = "pending_information";
    await complaint.save();
    await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "information_requested", actorRef: staff._id, message: request.requestMessage });
    await Notification.create({ userRef: student._id, type: "status_updated", title: "Additional information requested", body: "Please respond." });

    const attachment = await Attachment.create({
      complaintRef: complaint._id,
      uploadedByRef: student._id,
      fileUrl: "https://files.example.test/receipt.pdf",
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1200,
    });
    request.status = "responded";
    request.respondedAt = new Date();
    request.responseMessage = "I uploaded the clearer receipt.";
    request.responseAttachmentRefs = [attachment._id];
    await request.save();
    complaint.status = "in_progress";
    await complaint.save();
    await ComplaintTimeline.create({ complaintRef: complaint._id, eventType: "information_submitted", actorRef: student._id, message: request.responseMessage });

    const second = await InformationRequest.create({
      complaintRef: complaint._id,
      requestedByRef: staff._id,
      requestMessage: "Please also confirm the transaction date.",
      status: "open",
    });
    complaint.status = "pending_information";
    await complaint.save();

    const requests = await InformationRequest.find({ complaintRef: complaint._id }).sort({ requestedAt: 1 }).lean();
    const events = await ComplaintTimeline.find({ complaintRef: complaint._id }).lean();
    expect(requests).toHaveLength(2);
    expect(requests[0]!.status).toBe("responded");
    expect(requests[0]!.responseAttachmentRefs).toHaveLength(1);
    expect(requests[1]!._id.toString()).toBe(second._id.toString());
    expect(events.map((event) => event.eventType)).toEqual(["information_requested", "information_submitted"]);
    expect(await Notification.countDocuments({ userRef: student._id })).toBe(1);
  });
});
