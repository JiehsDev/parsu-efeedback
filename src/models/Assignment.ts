// Mongoose model: Assignment (collection: assignments)
// BR-047..BR-052.
//
// NEW — not in the original architecture-blueprint schema. The blueprint
// only kept assignedOfficeRef/assignedStaffRef directly on Complaint, which
// covers "who has it now" but not BR-047's requirement that a complaint
// "may have multiple assignment records throughout its lifecycle" with
// each one immutably recording who/what/when (BR-049, BR-052). See
// docs/schema-reconciliation.md for the full reasoning.
//
// Complaint.assignedOfficeRef/assignedStaffRef remain as the current-state
// pointers (cheap to query); this collection is the append-only history
// behind them, analogous to complaint_timeline but with assignment-specific
// structured fields rather than a generic message.
//
// BR-052 (previous records never modified): enforced at the repository
// layer (Phase 8) by only ever calling `.create()` here.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";

const assignmentSchema = new Schema(
  {
    complaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },

    // BR-049
    assignedByRef: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = system (initial routing)
    assignedToRef: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = office-level, not yet claimed by a person
    sourceOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", default: null },
    destinationOfficeRef: { type: Schema.Types.ObjectId, ref: "Office", required: true },
  },
  {
    // "Assignment Date" (BR-049) is this record's creation time
    timestamps: { createdAt: true, updatedAt: false },
  },
);

assignmentSchema.index({ complaintRef: 1, createdAt: 1 });

export type AssignmentDocument = InferSchemaType<typeof assignmentSchema>;
export const Assignment: Model<AssignmentDocument> =
  (models.Assignment as Model<AssignmentDocument> | undefined) ??
  model<AssignmentDocument>("Assignment", assignmentSchema, "assignments");
export default Assignment;
