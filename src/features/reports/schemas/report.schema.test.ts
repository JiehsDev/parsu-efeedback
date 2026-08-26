// src/features/reports/schemas/report.schema.test.ts
import { describe, it, expect } from "vitest";
import { exportReportSchema } from "./report.schema";

describe("report.schema — BR-079/080", () => {
  it("BR-079: accepts each documented output format (pdf, excel, csv)", () => {
    for (const format of ["pdf", "excel", "csv"] as const) {
      const result = exportReportSchema.safeParse({ format });
      expect(result.success).toBe(true);
    }
  });

  it("BR-079: rejects a format outside the documented set", () => {
    const result = exportReportSchema.safeParse({ format: "docx" });
    expect(result.success).toBe(false);
  });

  it("BR-080: filters are optional and default to an all-null/false shape", () => {
    const result = exportReportSchema.safeParse({ format: "csv" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filters).toEqual({
        officeRef: null,
        collegeRef: null,
        categoryRef: null,
        dateFrom: null,
        dateTo: null,
        status: null,
        slaOnly: false,
      });
    }
  });

  it("BR-080: accepts a fully specified filter set (office, college, category, date range, status, SLA-only)", () => {
    const result = exportReportSchema.safeParse({
      format: "pdf",
      filters: {
        officeRef: "office1",
        collegeRef: "college1",
        categoryRef: "cat1",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        status: "resolved",
        slaOnly: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults reportType to 'complaint-export' when omitted", () => {
    const result = exportReportSchema.safeParse({ format: "csv" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reportType).toBe("complaint-export");
    }
  });
});
