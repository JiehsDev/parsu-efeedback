import { createHash, randomUUID } from "node:crypto";
import { SLA_TIME_ZONE } from "@/lib/sla-calendar";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { getSettings } from "@/features/settings/services/settings.service";
import { resolveSlaRule, computeSlaDates } from "./sla.service";

const ACTIVE_STATUSES = [
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
] as const;

export async function planSlaRecalculation() {
  const settings = await getSettings();
  const complaints = await Complaint.find({ status: { $in: ACTIVE_STATUSES }, isArchived: false })
    .select(
      "_id ticketNumber categoryRef priority submittedAt updatedAt slaPolicy slaCalendarRevision slaResponseDueAt slaResolutionDueAt",
    )
    .sort({ _id: 1 })
    .lean();
  const rules = new Map<string, Awaited<ReturnType<typeof resolveSlaRule>>>();
  const rows = [];
  let skipped = 0;
  for (const complaint of complaints) {
    const key = `${complaint.categoryRef}:${complaint.priority}`;
    if (!rules.has(key)) {
      rules.set(
        key,
        await resolveSlaRule({
          categoryId: String(complaint.categoryRef),
          priority: complaint.priority,
        }),
      );
    }
    const rule = rules.get(key);
    if (!rule || !complaint.submittedAt) {
      skipped++;
      continue;
    }
    const dates = computeSlaDates(
      new Date(complaint.slaPolicy?.startedAt ?? complaint.submittedAt),
      rule,
      settings.slaHolidays ?? [],
    );
    const previous = {
      responseDue: complaint.slaResponseDueAt,
      resolutionDue: complaint.slaResolutionDueAt,
      policy: complaint.slaPolicy,
    };
    if (
      JSON.stringify(previous) ===
      JSON.stringify({
        responseDue: dates.slaResponseDueAt,
        resolutionDue: dates.slaResolutionDueAt,
        policy: dates.slaPolicy,
      })
    )
      continue;
    rows.push({
      id: String(complaint._id),
      ticketNumber: complaint.ticketNumber,
      updatedAt: complaint.updatedAt,
      previousRevision: complaint.slaCalendarRevision ?? null,
      previous,
      ...dates,
    });
  }
  const token = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  return { token, rows, skipped };
}

export async function applySlaRecalculation(
  plan: Awaited<ReturnType<typeof planSlaRecalculation>>,
  actorId: string,
) {
  if (!plan.rows.length) return { updated: 0, skipped: plan.skipped };
  const now = new Date();
  const revision = randomUUID();
  await Complaint.bulkWrite(
    plan.rows.map((row) => ({
      updateOne: {
        filter: {
          _id: row.id,
          updatedAt: row.updatedAt,
          slaCalendarRevision: row.previousRevision,
          status: { $in: ACTIVE_STATUSES },
          isArchived: false,
        },
        update: {
          $set: {
            slaResponseDueAt: row.slaResponseDueAt,
            slaResolutionDueAt: row.slaResolutionDueAt,
            slaPolicy: row.slaPolicy,
            slaCalendarRevision: revision,
            lastWarningNotifiedAt: null,
            lastResponseWarningNotifiedAt: null,
            updatedAt: now,
          },
        },
        timestamps: false,
      },
    })),
    { timestamps: false },
  );
  // The revision identifies only successful optimistic updates. A complaint
  // changed/resolved/archived since the preview is never overwritten.
  const updated = await Complaint.find({
    _id: { $in: plan.rows.map((row) => row.id) },
    slaCalendarRevision: revision,
  })
    .select("_id assignedStaffRef slaResponseDueAt slaResolutionDueAt isOverdue")
    .lean();
  const ids = new Set(updated.map((row) => String(row._id)));
  if (updated.length)
    await Complaint.bulkWrite(
      updated.map((complaint) => {
        const isOverdue =
          now >= complaint.slaResolutionDueAt! ||
          (!complaint.assignedStaffRef && now >= complaint.slaResponseDueAt!);
        return {
          updateOne: {
            filter: {
              _id: complaint._id,
              updatedAt: now,
              slaCalendarRevision: revision,
              status: { $in: ACTIVE_STATUSES },
            },
            update: { $set: { isOverdue: complaint.isOverdue && isOverdue } },
            timestamps: false,
          },
        };
      }),
      { timestamps: false },
    );
  if (updated.length) {
    await ComplaintTimeline.insertMany(
      plan.rows
        .filter((row) => ids.has(row.id))
        .map((row) => ({
          complaintRef: row.id,
          actorRef: actorId,
          eventType: "status_changed",
          message: `SLA calendar recalculated: 24 hours per weekday; weekends and configured holidays excluded (Philippine time). Response due: ${row.slaResponseDueAt.toLocaleString("en-PH", { timeZone: SLA_TIME_ZONE })}; resolution due: ${row.slaResolutionDueAt.toLocaleString("en-PH", { timeZone: SLA_TIME_ZONE })}.`,
        })),
    );
  }
  return { updated: updated.length, skipped: plan.skipped + plan.rows.length - updated.length };
}
