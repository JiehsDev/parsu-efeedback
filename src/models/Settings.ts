// src/models/Settings.ts
// Singleton app configuration, editable by admins at runtime. Replaces
// what were previously fixed env vars (TICKET_NUMBER_PREFIX,
// UPLOAD_MAX_FILE_SIZE_MB, UPLOAD_ALLOWED_MIME_TYPES,
// AUTH_MAX_FAILED_LOGIN_ATTEMPTS, AUTH_LOCKOUT_DURATION_MINUTES,
// AUTH_SESSION_MAX_AGE_MINUTES) with values an admin can change without a
// redeploy. Always exactly one document, with a fixed _id so it's a true
// singleton (findOneAndUpdate with upsert, never findOne + create races).

import { Schema, model, models, Model, type InferSchemaType } from "mongoose";

const SETTINGS_SINGLETON_ID = "global";

const settingsSchema = new Schema(
  {
    _id: { type: String, default: SETTINGS_SINGLETON_ID },

    ticketNumberPrefix: { type: String, required: true, default: "PARSU" },

    uploadMaxFileSizeMb: { type: Number, required: true, default: 10 },
    uploadAllowedMimeTypes: {
      type: [String],
      required: true,
      default: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    },

    authMaxFailedLoginAttempts: { type: Number, required: true, default: 5 },
    authLockoutDurationMinutes: { type: Number, required: true, default: 15 },
    authSessionMaxAgeMinutes: { type: Number, required: true, default: 480 },

    // Heartbeat stamped by the SLA cron (src/app/api/cron/sla-check/route.ts)
    // on every successful run — the admin dashboard's health checklist reads
    // this to detect a silently-stopped cron, which a 0-escalation run would
    // otherwise leave no other trace of.
    lastSlaCheckAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type SettingsDocument = InferSchemaType<typeof settingsSchema>;
export const Settings: Model<SettingsDocument> =
  (models.Settings as Model<SettingsDocument> | undefined) ??
  model<SettingsDocument>("Settings", settingsSchema, "settings");
export { SETTINGS_SINGLETON_ID };
export default Settings;
