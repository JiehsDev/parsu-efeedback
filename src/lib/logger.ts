/**
 * Minimal structured logger. No external dependency — just consistent
 * shape (level, message, timestamp, optional context) so log lines are
 * greppable/parseable in any hosting platform's log viewer (Vercel,
 * Cloudflare) without needing a log-drain service on a free tier.
 *
 * Intentionally dumb: no transports, no log levels config, no rotation.
 * If that's ever needed, swap the implementation here — every call site
 * elsewhere in the app just does `logger.info(...)`.
 */

type LogContext = Record<string, unknown>;

function write(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: LogContext,
) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    write("debug", message, context),
  info: (message: string, context?: LogContext) =>
    write("info", message, context),
  warn: (message: string, context?: LogContext) =>
    write("warn", message, context),
  error: (message: string, context?: LogContext) =>
    write("error", message, context),
};
