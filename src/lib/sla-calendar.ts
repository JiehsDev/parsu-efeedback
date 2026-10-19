// Philippine civil dates (UTC+8, no daylight saving). Each eligible date
// contributes 24 hours; weekends and configured holidays contribute zero.
export const SLA_TIME_ZONE = "Asia/Manila";
const DAY_MS = 86_400_000;
const OFFSET_MS = 8 * 3_600_000;

export interface SlaPolicy {
  version: number;
  holidays: readonly string[];
  startedAt: Date | string;
  responseHours: number;
  resolutionHours: number;
  warningThresholdPercent: number;
}

function calendar(holidays: readonly string[]) {
  const excluded = new Set(holidays);
  return (time: number) => {
    const local = new Date(time + OFFSET_MS);
    const weekday = local.getUTCDay();
    return weekday !== 0 && weekday !== 6 && !excluded.has(local.toISOString().slice(0, 10));
  };
}

function nextMidnight(time: number) {
  return (Math.floor((time + OFFSET_MS) / DAY_MS) + 1) * DAY_MS - OFFSET_MS;
}

export function addSlaHours(start: Date, hours: number, holidays: readonly string[] = []): Date {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(hours) || hours < 0) {
    throw new Error("A valid start date and nonnegative SLA hours are required.");
  }
  const eligible = calendar(holidays);
  let time = start.getTime();
  let remaining = hours * 3_600_000;
  while (remaining > 0 || !eligible(time)) {
    const midnight = nextMidnight(time);
    if (!eligible(time)) {
      time = midnight;
      continue;
    }
    const consumed = Math.min(remaining, midnight - time);
    remaining -= consumed;
    time += consumed;
  }
  return new Date(time);
}

export function eligibleElapsedMs(
  start: Date,
  end: Date,
  holidays: readonly string[] = [],
): number {
  const eligible = calendar(holidays);
  let time = start.getTime();
  const finish = end.getTime();
  if (!Number.isFinite(time) || !Number.isFinite(finish)) return 0;
  let elapsed = 0;
  while (time < finish) {
    const next = Math.min(nextMidnight(time), finish);
    if (eligible(time)) elapsed += next - time;
    time = next;
  }
  return elapsed;
}

// Missing policy means an existing complaint retains its original calendar
// hours. Never reinterpret historical durations using today's holiday list.
export function elapsedSlaMs(start: Date | string, end: Date | string, policy?: SlaPolicy | null) {
  const from = new Date(start);
  const to = new Date(end);
  return policy?.version === 1
    ? eligibleElapsedMs(from, to, policy.holidays)
    : Math.max(0, to.getTime() - from.getTime());
}

export function slaElapsedPercent(
  now: Date,
  dueAt: Date,
  clock: "response" | "resolution",
  legacyHours: number,
  policy?: SlaPolicy | null,
) {
  const hours =
    policy?.version === 1
      ? clock === "response"
        ? policy.responseHours
        : policy.resolutionHours
      : legacyHours;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  const start =
    policy?.version === 1 ? policy.startedAt : new Date(dueAt.getTime() - hours * 3_600_000);
  return (elapsedSlaMs(start, now, policy) / (hours * 3_600_000)) * 100;
}
