// Mongoose model: Notification (collection: notifications)
// BR-071..BR-074.

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";
import { NOTIFICATION_TYPES } from "@/lib/constants";

const notificationSchema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    relatedComplaintRef: { type: Schema.Types.ObjectId, ref: "Complaint", default: null },

    // BR-073
    isRead: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

notificationSchema.index({ userRef: 1, isRead: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification: Model<NotificationDocument> =
  (models.Notification as Model<NotificationDocument> | undefined) ??
  model<NotificationDocument>("Notification", notificationSchema, "notifications");
export default Notification;
