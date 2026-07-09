/**
 * Centralized, validated environment access.
 *
 * Nothing in this codebase should read `process.env.X` directly outside this
 * file. Every later phase imports `env` from here instead:
 *
 *   import { env } from "@/lib/env";
 *   await mongoose.connect(env.MONGODB_URI);          // Phase 5
 *   maxAttempts: env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS    // Phase 6, BR-013
 *
 * Why centralize this now (Phase 4), before anything consumes it:
 *   - One Zod schema documents every variable's shape/type in one place,
 *     instead of ad-hoc `process.env.FOO!` casts scattered per feature.
 *   - Missing or malformed config fails fast at import time with a clear
 *     list of what's wrong, rather than as a confusing runtime error three
 *     layers deep in Phase 8's routing engine.
 *   - Business-rule-driven thresholds (BR-013, BR-060, BR-061, BR-087,
 *     BR-036) are parsed into real types (number, string[]) exactly once —
 *     see docs/business-rules.md for what each one means.
 *
 * This file intentionally contains no business logic — only config
 * shape/validation. Values are used starting in the phases noted above.
 */

import { z } from "zod";

const commaSeparatedList = (defaultValue: string) =>
  z
    .string()
    .min(1, "must be a non-empty comma-separated list")
    .default(defaultValue)
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );

const positiveInt = z.coerce.number().int().positive();

const envSchema = z.object({
  // --- App ---
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // --- Database (MongoDB Atlas M0) ---
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // --- Auth.js ---
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url(),

  // --- File Storage (Cloudflare R2) ---
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),

  // --- Email (Resend) ---
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  RESEND_DEV_TEST_EMAIL: z.string().email(),

  // --- Rate limiting / Cron (Upstash) ---
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(16, "CRON_SECRET should be a long random string"),

  // --- Business rule thresholds (see docs/business-rules.md) ---
  AUTH_MAX_FAILED_LOGIN_ATTEMPTS: positiveInt.default(5), // BR-013
  AUTH_LOCKOUT_DURATION_MINUTES: positiveInt.default(15), // BR-013
  AUTH_SESSION_MAX_AGE_MINUTES: positiveInt.default(60), // BR-087
  UPLOAD_MAX_FILE_SIZE_MB: positiveInt.default(10), // BR-061
  UPLOAD_ALLOWED_MIME_TYPES: commaSeparatedList(
    "image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ), // BR-060
  TICKET_NUMBER_PREFIX: z.string().min(1).default("PARSU"), // BR-036 / BR-100
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid/missing environment variables. Copy .env.example to .env.local ` +
        `and fill in the values described in docs/business-rules.md and ` +
        `docs/architecture.md (section 13).\n${issues}`,
    );
  }

  return parsed.data;
}

// Lazily validated on first import rather than at module scope on disk-load
// order, so tooling that imports this file without a configured .env.local
// (e.g. a future test file that mocks process.env first) isn't punished by
// eager validation. Consumers just use `env` as a plain object.
let cached: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    if (!cached) {
      cached = loadEnv();
    }
    return cached[prop as keyof Env];
  },
});
