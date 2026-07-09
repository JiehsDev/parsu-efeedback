// src/features/attachments/attachments.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Attachment } from "@/models/Attachment";
import { Complaint } from "@/models/Complaint";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("Attachments — BR-058/059/062", () => {
  async function setup() {
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

  it("BR-058: a complaint may have multiple attachments", async () => {
    const { complaint, student } = await setup();
    await Attachment.create({
      complaintRef: complaint._id,
      uploadedByRef: student._id,
      fileUrl: "https://example.com/a.pdf",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
    });
    await Attachment.create({
      complaintRef: complaint._id,
      uploadedByRef: student._id,
      fileUrl: "https://example.com/b.pdf",
      fileName: "b.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2000,
    });

    const attachments = await Attachment.find({ complaintRef: complaint._id });
    expect(attachments).toHaveLength(2);
  });

  it("BR-059: schema stores only metadata fields, no binary content field exists", async () => {
    const { complaint, student } = await setup();
    const attachment = await Attachment.create({
      complaintRef: complaint._id,
      uploadedByRef: student._id,
      fileUrl: "https://example.com/a.pdf",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
    });

    const obj = attachment.toObject();
    expect(obj).not.toHaveProperty("fileData");
    expect(obj).not.toHaveProperty("binary");
    expect(obj.fileUrl).toBe("https://example.com/a.pdf");
  });

  it("BR-062: deleting an attachment does not delete the complaint", async () => {
    const { complaint, student } = await setup();
    const attachment = await Attachment.create({
      complaintRef: complaint._id,
      uploadedByRef: student._id,
      fileUrl: "https://example.com/a.pdf",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
    });

    await Attachment.findByIdAndDelete(attachment._id);

    const stillExists = await Complaint.findById(complaint._id);
    expect(stillExists).not.toBeNull();
  });
});
