// Mongoose model: GeneratedReport (collection: generated_reports)
// BR-078..BR-082.
//
// NEW — not in the original architecture-blueprint schema. Section 11 of
// the blueprint specified a stateless export endpoint ("no storage of
// generated reports"), but BR-078/082 require persisted report records
// (creator, type, format, filters, status, download URL, timestamp). This
// model reconciles that: a row is written when generation starts and
// updated to ready/failed with a downloadUrl once complete (Phase 14).
// See docs/schema-reconciliation.md.

import { Schema, model, models, type InferSchemaType } from "mongoose";
import { REPORT_FORMATS, REPORT_STATUSES } from "@/lib/constants";

const generatedReportSchema = new Schema(
  {
    creatorRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportType: { type: String, required: true }, // e.g. "sla-compliance", "complaint-volume"
    fileFormat: { type: String, enum: REPORT_FORMATS, required: true },

    // BR-081: filters this report was generated with
    filters: {
      officeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },
      collegeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },
      categoryRef: { type: Schema.Types.ObjectId, ref: "Category", default: null },
      dateFrom: { type: Date, default: null },
      dateTo: { type: Date, default: null },
      status: { type: String, default: null },
      slaOnly: { type: Boolean, default: false },
    },

    status: { type: String, enum: REPORT_STATUSES, required: true, default: "pending" },
    downloadUrl: { type: String, default: null }, // set once status = "ready"
  },
  {
    // "Generation Timestamp" (BR-082) is this record's creation time;
    // updatedAt tracks pending → ready/failed transitions
    timestamps: true,
  },
);

generatedReportSchema.index({ creatorRef: 1, createdAt: -1 });

export type GeneratedReportDocument = InferSchemaType<typeof generatedReportSchema>;
export const GeneratedReport =
  models.GeneratedReport ??
  model("GeneratedReport", generatedReportSchema, "generated_reports");
export default GeneratedReport;
