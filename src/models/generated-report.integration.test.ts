// src/models/generated-report.integration.test.ts
// BR-078/079/080/081/082
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { GeneratedReport } from "@/models/GeneratedReport";
import { createTestUser, createTestOffice } from "@/test/fixtures";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("GeneratedReport model — BR-078/079/080/081/082", () => {
  it("BR-078: creatorRef is required — rejects creation without it", async () => {
    await expect(
      GeneratedReport.create({
        reportType: "complaint-export",
        format: "pdf",
      } as any),
    ).rejects.toThrow();
  });

  it("BR-078: a report record belongs to exactly one creating user", async () => {
    const creator = await createTestUser({ role: "administrator" });
    const report = await GeneratedReport.create({
      creatorRef: creator._id,
      reportType: "complaint-export",
      format: "pdf",
    });
    expect(String(report.creatorRef)).toBe(String(creator._id));
  });

  it("BR-079: format is restricted to the documented set (pdf, excel, csv)", async () => {
    const creator = await createTestUser({ role: "administrator" });
    await expect(
      GeneratedReport.create({
        creatorRef: creator._id,
        reportType: "complaint-export",
        format: "docx",
      } as any),
    ).rejects.toThrow();
  });

  it("BR-081: the filters used to generate the report are persisted alongside the record", async () => {
    const creator = await createTestUser({ role: "administrator" });
    const office = await createTestOffice();
    const report = await GeneratedReport.create({
      creatorRef: creator._id,
      reportType: "sla-compliance",
      format: "excel",
      filters: {
        officeRef: office._id,
        status: "resolved",
        slaOnly: true,
      },
    });

    const saved = await GeneratedReport.findById(report._id).lean();
    expect(String((saved as any)!.filters.officeRef)).toBe(String(office._id));
    expect((saved as any)!.filters.status).toBe("resolved");
    expect((saved as any)!.filters.slaOnly).toBe(true);
  });

  it("BR-082: a generation (creation) timestamp is auto-stamped", async () => {
    const creator = await createTestUser({ role: "administrator" });
    const report = await GeneratedReport.create({
      creatorRef: creator._id,
      reportType: "complaint-export",
      format: "csv",
    });
    expect(report.get("createdAt")).toBeInstanceOf(Date);
  });

  it("status defaults to 'pending' and is restricted to the documented enum", async () => {
    const creator = await createTestUser({ role: "administrator" });
    const report = await GeneratedReport.create({
      creatorRef: creator._id,
      reportType: "complaint-export",
      format: "csv",
    });
    expect(report.status).toBe("pending");

    await expect(
      GeneratedReport.create({
        creatorRef: creator._id,
        reportType: "complaint-export",
        format: "csv",
        status: "not_a_real_status",
      } as any),
    ).rejects.toThrow();
  });

  it("status transitions to ready with a downloadUrl once generation completes", async () => {
    const creator = await createTestUser({ role: "administrator" });
    const report = await GeneratedReport.create({
      creatorRef: creator._id,
      reportType: "complaint-export",
      format: "csv",
    });

    report.status = "ready";
    report.downloadUrl = "https://example.com/reports/1.csv";
    await report.save();

    const saved = await GeneratedReport.findById(report._id).lean();
    expect((saved as any)!.status).toBe("ready");
    expect((saved as any)!.downloadUrl).toBe("https://example.com/reports/1.csv");
  });
});
