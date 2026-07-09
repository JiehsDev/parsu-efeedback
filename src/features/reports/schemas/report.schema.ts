// src/features/reports/schemas/report.schema.ts
import { z } from "zod";
import { REPORT_FORMATS } from "@/lib/constants";

const DEFAULT_FILTERS = {
  officeRef: null,
  collegeRef: null,
  categoryRef: null,
  dateFrom: null,
  dateTo: null,
  status: null,
  slaOnly: false,
};

export const exportReportSchema = z.object({
  reportType: z.string().trim().min(1).default("complaint-export"),
  format: z.enum(REPORT_FORMATS),
  filters: z
    .object({
      officeRef: z.string().nullable().optional(),
      collegeRef: z.string().nullable().optional(),
      categoryRef: z.string().nullable().optional(),
      dateFrom: z.string().nullable().optional(),
      dateTo: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      slaOnly: z.boolean().optional().default(false),
    })
    .optional()
    .default(DEFAULT_FILTERS),
});

export type ExportReportInput = z.infer<typeof exportReportSchema>;
