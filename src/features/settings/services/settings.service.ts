// src/features/settings/services/settings.service.ts
import { connectToDatabase } from "@/lib/db";
import { Settings, SETTINGS_SINGLETON_ID } from "@/models/Settings";

export async function getSettings() {
  await connectToDatabase();

  // Upsert-on-read: guarantees a document always exists with defaults,
  // without needing a separate seed step.
  const settings = await Settings.findOneAndUpdate(
    { _id: SETTINGS_SINGLETON_ID },
    { $setOnInsert: { _id: SETTINGS_SINGLETON_ID } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  return settings!;
}

export async function updateSettings(
  patch: Partial<{
    ticketNumberPrefix: string;
    uploadMaxFileSizeMb: number;
    uploadAllowedMimeTypes: string[];
    authMaxFailedLoginAttempts: number;
    authLockoutDurationMinutes: number;
    authSessionMaxAgeMinutes: number;
    lastSlaCheckAt: Date;
  }>,
) {
  await connectToDatabase();

  const updated = await Settings.findOneAndUpdate(
    { _id: SETTINGS_SINGLETON_ID },
    { $set: patch },
    { upsert: true, returnDocument: "after" },
  ).lean();

  return updated;
}
