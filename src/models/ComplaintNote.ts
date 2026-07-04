// Mongoose model: ComplaintNote (collection: complaint_notes)
// BR-063..BR-066. Separate from the timeline because notes are
// role-gated/private and never shown to students (BR-063/064).
//
// BR-066 (not editable after creation): enforced at the repository/service
// layer (Phase 8) by only exposing a create operation — no update route is
// ever wired up for this model. Not a schema-level hook, to keep this file
// pure persistence/shape.

import { Schema, model, models, type InferSchemaType } from "mongoose";

const complaintNoteSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    authorRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },

    // BR-063/064: always true in practice; kept explicit so a query filter
    // (e.g. student-facing endpoints) can defensively check this field
    // rather than relying solely on "this collection is never queried for
    // students" being true everywhere forever.
    isInternal: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

complaintNoteSchema.index({ complaintRef: 1, createdAt: 1 });

export type ComplaintNoteDocument = InferSchemaType<typeof complaintNoteSchema>;
export const ComplaintNote =
  models.ComplaintNote ??
  model("ComplaintNote", complaintNoteSchema, "complaint_notes");
export default ComplaintNote;
