// src/features/attachments/attachments.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { Attachment } from "@/models/Attachment";
import { Complaint } from "@/models/Complaint";
import { Settings, SETTINGS_SINGLETON_ID } from "@/models/Settings";
import { createTestUser, createActivatableCategory } from "@/test/fixtures";
import { presignUploadSchema, createAttachmentSchema } from "@/features/attachments/schemas/attachment.schema";

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

describe("Upload MIME/size policy — BR-060/061", () => {
  // The MIME allow-list and max size are NOT hardcoded in
  // attachment.schema.ts (presignUploadSchema/createAttachmentSchema
  // accept any nonempty mimeType string and any positive sizeBytes) —
  // they're read from the Settings singleton at request time by the route
  // handler (src/app/api/uploads/presign/route.ts), which is out of scope
  // under the no-route-import rule. What IS separably testable here: (1)
  // the schema is deliberately permissive/not the enforcement point, and
  // (2) Settings persists a real, configurable MIME allow-list and max
  // size for that handler to read.
  it("BR-060: presignUploadSchema does not itself restrict mimeType to a fixed allow-list", () => {
    const result = presignUploadSchema.safeParse({
      complaintId: "someid",
      fileName: "malware.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 100,
    });
    // Schema-level acceptance is expected — the real allow-list check is
    // Settings-driven in the route handler, not here.
    expect(result.success).toBe(true);
  });

  it("BR-061: createAttachmentSchema requires a positive integer sizeBytes but enforces no upper bound itself", () => {
    const result = createAttachmentSchema.safeParse({
      fileUrl: "https://example.com/huge.pdf",
      fileName: "huge.pdf",
      mimeType: "application/pdf",
      sizeBytes: 999_999_999_999,
    });
    expect(result.success).toBe(true);

    const negative = createAttachmentSchema.safeParse({
      fileUrl: "https://example.com/bad.pdf",
      fileName: "bad.pdf",
      mimeType: "application/pdf",
      sizeBytes: -1,
    });
    expect(negative.success).toBe(false);
  });

  it("BR-060/061: Settings persists a configurable, real MIME allow-list and max file size for the route handler to enforce", async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_SINGLETON_ID },
      { $set: { uploadAllowedMimeTypes: ["application/pdf", "image/png"], uploadMaxFileSizeMb: 5 } },
      { upsert: true },
    );

    const settings = await Settings.findById(SETTINGS_SINGLETON_ID).lean();
    expect(settings!.uploadAllowedMimeTypes).toEqual(["application/pdf", "image/png"]);
    expect(settings!.uploadMaxFileSizeMb).toBe(5);
  });

  it("BR-060/061: default Settings allow-list includes the approved project file types with a 10 MB max", async () => {
    const settings = await new Settings().save();
    expect(settings.uploadMaxFileSizeMb).toBe(10);
    expect(settings.uploadAllowedMimeTypes).toEqual(
      expect.arrayContaining([
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]),
    );
  });
});
