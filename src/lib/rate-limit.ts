// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";
import { logger } from "./logger";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:login",
  analytics: false,
});

export const registerRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:register",
  analytics: false,
});

export const passwordResetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:password-reset",
  analytics: false,
});

export const apiMutationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:api-mutation",
  analytics: false,
});

/**
 * Turns a Ratelimit result into a plain object so route handlers don't
 * need to know about the underlying library's response shape.
 *
 * Fails OPEN (allows the request) if Redis is unreachable — e.g. no real
 * Upstash Redis instance configured yet in local dev, only a placeholder
 * URL. Rate limiting is a defense-in-depth layer (architecture.md §4 rule
 * 5), not the only guard on these routes (BR-013's per-account lockout is
 * separate and still applies), so a broken Redis connection should degrade
 * gracefully rather than 500 every request depending on it.
 */
export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    logger.error("Rate limiter unreachable, failing open (request allowed)", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

export function getRequestIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}
