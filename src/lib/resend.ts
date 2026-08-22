// src/lib/resend.ts
import { Resend } from "resend";
import { env } from "./env";

export const resend = new Resend(env.RESEND_API_KEY);

// Presence-only, same bar as isR2Configured() in ./r2.ts — env.ts already
// requires these to be non-empty strings before the app boots, so this
// confirms the config was actually supplied rather than proving Resend is
// reachable or the key is valid.
export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}
