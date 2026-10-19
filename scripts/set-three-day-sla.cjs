/* eslint-disable @typescript-eslint/no-require-imports */
// Requires Node 22.18+ for the shared TypeScript calendar helper.
// Preview: node scripts/set-three-day-sla.cjs
// Apply:   node scripts/set-three-day-sla.cjs --apply
// Sets both response and resolution to three SLA days.
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");
const { randomUUID } = require("node:crypto");
const { addSlaHours } = require("../src/lib/sla-calendar.ts");

loadEnvConfig(process.cwd());
const HOURS = 72;
const ACTIVE = ["submitted", "assigned", "in_progress", "pending_information", "escalated"];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db();
    const rules = db.collection("sla_rules");
    const complaints = db.collection("complaints");
    const settings = await db.collection("settings").findOne({ _id: "global" });
    const activeFilter = { status: { $in: ACTIVE }, isArchived: false };
    const rows = await complaints.find(activeFilter).toArray();
    const plan = rows
      .map((complaint) => {
        const policy = complaint.slaPolicy;
        const start = new Date(policy?.startedAt ?? complaint.submittedAt);
        if (!Number.isFinite(start.getTime()))
          throw new Error("Complaint has no valid SLA start date");
        const newPolicy = {
          version: 1,
          holidays: policy?.version === 1 ? (policy.holidays ?? []) : (settings?.slaHolidays ?? []),
          startedAt: start,
          responseHours: HOURS,
          resolutionHours: HOURS,
          warningThresholdPercent: policy?.warningThresholdPercent ?? 80,
        };
        const due = addSlaHours(start, HOURS, newPolicy.holidays);
        return { complaint, due, newPolicy };
      })
      .filter(
        ({ complaint, due }) =>
          complaint.slaResolutionDueAt?.getTime() !== due.getTime() ||
          complaint.slaResponseDueAt?.getTime() !== due.getTime() ||
          complaint.slaPolicy?.version !== 1 ||
          complaint.slaPolicy.resolutionHours !== HOURS ||
          complaint.slaPolicy.responseHours !== HOURS,
      );
    const ruleFilter = {
      isActive: true,
      $or: [{ resolutionHours: { $ne: HOURS } }, { responseHours: { $ne: HOURS } }],
    };
    const ruleCount = await rules.countDocuments(ruleFilter);
    const apply = process.argv.includes("--apply");
    let updated = 0;
    if (apply) {
      const now = new Date();
      const result = await rules.updateMany(ruleFilter, {
        $set: { responseHours: HOURS, resolutionHours: HOURS, updatedAt: now },
      });
      console.log(`Updated ${result.modifiedCount} active SLA rules.`);
      for (const { complaint, due, newPolicy } of plan) {
        const changes = {
          slaResolutionDueAt: due,
          slaResponseDueAt: due,
          slaPolicy: newPolicy,
          updatedAt: now,
          slaCalendarRevision: randomUUID(),
          lastWarningNotifiedAt: null,
          lastResponseWarningNotifiedAt: null,
          isOverdue: now >= due,
        };
        const result = await complaints.updateOne(
          { ...activeFilter, _id: complaint._id, updatedAt: complaint.updatedAt },
          { $set: changes },
        );
        if (!result.modifiedCount) continue;
        updated++;
        await db.collection("complaint_timeline").insertOne({
          complaintRef: complaint._id,
          actorRef: null,
          eventType: "status_changed",
          message:
            "Response and resolution SLA updated to 3 days (72 SLA hours); weekends and configured holidays excluded.",
          createdAt: now,
        });
      }
    }
    console.log(
      apply
        ? `Updated ${updated} active complaint deadlines; ${plan.length - updated} skipped after concurrent changes.`
        : `Preview: ${ruleCount} active SLA rules and ${plan.length} active complaint deadlines to update.`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
