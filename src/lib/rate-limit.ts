/**
 * Upstash Redis rate limiters.
 *
 * Distinct from BR-013's per-account lockout (counted on the User document
 * itself, in features/auth/services/auth.service.ts): this file throttles
 * by *request origin* (IP, optionally combined with the submitted email) so
 * a single attacker can't hammer many different accounts, or retry a single
 * account from many processes, faster than Redis allows. Both mechanisms
 * are needed — see docs/architecture.md section 4, rule 5, and section 5,
 * step 2d.
 *
 * Sliding-window limiters, one Redis instance shared across limiters
 * (cheap on Upstash's request-based free tier — no need for one instance
 * per limiter).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Login attempts: 10 per minute per identifier (IP, or IP+email — see
// callers). Looser than the per-account lockout (BR-013,
// AUTH_MAX_FAILED_LOGIN_ATTEMPTS) since this guards against distributed
// credential stuffing, not a single user mistyping their password.
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:login",
  analytics: false,
});

// Registration: stricter — 5 per hour per IP. Self-registration creates a
// real document in `users`, so this is the main spam/abuse vector to guard
// on this route.
export const registerRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:register",
  analytics: false,
});

// Password-reset requests: 5 per hour per IP+email. Loose enough that a
// user retrying a typo'd email isn't blocked, tight enough to stop this
// endpoint being used as an email bomb against one address.
export const passwordResetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:password-reset",
  analytics: false,
});

// General API mutation limiter, referenced by architecture.md section 4
// rule 5 for POST /api/complaints. Scaffolded here (lib is otherwise
// untouched since Phase 4) since it's the same Redis client/pattern; the
// complaints route itself starts consuming this in Phase 8.
export const apiMutationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:api-mutation",
  analytics: false,
});

/**
 * Turns a Ratelimit result into a plain object so route handlers don't
 * need to know about the underlying library's response shape.
 */
export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Best-effort client IP extraction for Next.js Route Handlers running on
 * platforms (Cloudflare Pages, Vercel) that set these forwarding headers.
 * Falls back to a constant so rate limiting still applies (shared bucket)
 * rather than throwing when no header is present (e.g. local dev).
 */
export function getRequestIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}
