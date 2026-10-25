/* eslint-disable @typescript-eslint/no-require-imports */
// Preview by default. Apply: node scripts/centralize-osas.cjs --apply
// This migration never resets tickets, users, histories, or closed/archived complaints.
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, BSON } = require("mongodb");
const { SEED_CATEGORIES } = require("../src/features/seed/categories.ts");

async function centralizeOsas(db, { apply = false, backupDirectory } = {}) {
  const office = await db.collection("offices").findOne({ code: "OSAS", isActive: true });
  if (!office) throw new Error("An active OSAS office is required before migration.");
  const categories = await db.collection("categories").find({}).toArray();
  const routes = await db.collection("routing_rules").find({ isActive: true }).toArray();
  const rules = await db.collection("sla_rules").find({ isActive: true }).toArray();
  const active = await db
    .collection("complaints")
    .find({
      isArchived: false,
      forwardedAt: null,
      status: { $in: ["submitted", "assigned", "in_progress", "pending_information", "escalated"] },
    })
    .toArray();
  const staff = await db
    .collection("users")
    .find({ officeRef: office._id, isActive: true, role: { $in: ["osas", "office_staff"] } })
    .toArray();
  const validStaff = new Set(
    staff
      .filter(
        (user) => user.role === "office_staff" || String(user._id) === String(office.headUserRef),
      )
      .map((user) => String(user._id)),
  );
  const plans = active
    .map((complaint) => {
      const target = validStaff.has(String(complaint.assignedStaffRef))
        ? complaint.assignedStaffRef
        : null;
      let status = complaint.status;
      if (["assigned", "escalated"].includes(status)) status = target ? "in_progress" : "submitted";
      if (!target && status === "in_progress") status = "submitted";
      return { complaint, target, status };
    })
    .filter(
      ({ complaint, target, status }) =>
        String(complaint.assignedOfficeRef) !== String(office._id) ||
        String(complaint.assignedStaffRef ?? "") !== String(target ?? "") ||
        status !== complaint.status,
    );
  const summary = {
    activeComplaintsToMigrate: plans.length,
    categories: categories.length,
    activeRoutingRules: routes.length,
    activeSlaRules: rules.length,
    updated: 0,
    skipped: 0,
  };
  if (!apply) return summary;
  if (backupDirectory) {
    fs.mkdirSync(backupDirectory, { recursive: true });
    const file = path.join(backupDirectory, `osas-migration-${Date.now()}.json`);
    fs.writeFileSync(
      file,
      BSON.EJSON.stringify(
        { createdAt: new Date(), office, categories, routes, rules, complaints: active },
        null,
        2,
        { relaxed: false },
      ),
      { flag: "wx" },
    );
    summary.backupFile = file;
  }
  await db
    .collection("categories")
    .updateMany({}, { $set: { defaultOfficeRef: office._id, updatedAt: new Date() } });
  const domains = new Map(SEED_CATEGORIES.map((category) => [category.name, category.domain]));
  for (const category of categories) {
    if (!category.domain && domains.has(category.name))
      await db
        .collection("categories")
        .updateOne(
          { _id: category._id, domain: { $exists: false } },
          { $set: { domain: domains.get(category.name) } },
        );
  }
  for (const category of categories.filter((row) => row.isActive)) {
    await db.collection("routing_rules").updateOne(
      { categoryRef: category._id, isActive: true },
      {
        $set: { targetOfficeRef: office._id, conditions: {}, updatedAt: new Date() },
        $setOnInsert: { categoryRef: category._id, isActive: true, createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  await db
    .collection("sla_rules")
    .updateMany({ isActive: true }, { $set: { escalateToOfficeRef: null, updatedAt: new Date() } });
  for (const { complaint, target, status } of plans) {
    const now = new Date();
    const result = await db.collection("complaints").updateOne(
      {
        _id: complaint._id,
        updatedAt: complaint.updatedAt,
        isArchived: false,
        status: complaint.status,
      },
      {
        $set: {
          initialOfficeRef: office._id,
          assignedOfficeRef: office._id,
          assignedStaffRef: target,
          status,
          updatedAt: now,
        },
        $inc: { __v: 1 },
      },
    );
    if (!result.modifiedCount) {
      summary.skipped++;
      continue;
    }
    summary.updated++;
    const message =
      "Centralized handling migration: responsibility moved to OSAS; invalid non-OSAS assignees cleared. Existing history retained.";
    await db.collection("complaint_timeline").insertOne({
      complaintRef: complaint._id,
      actorRef: null,
      eventType: "reassigned",
      fromValue: complaint.status,
      toValue: status,
      message,
      createdAt: now,
    });
    await db.collection("assignments").insertOne({
      complaintRef: complaint._id,
      assignedByRef: null,
      assignedToRef: target,
      sourceOfficeRef: complaint.assignedOfficeRef ?? null,
      destinationOfficeRef: office._id,
      actionType: "reassign",
      reason: message,
      createdAt: now,
    });
    await db.collection("audit_logs").insertOne({
      actorRef: null,
      action: "complaint.osas_migration",
      entityType: "Complaint",
      entityId: complaint._id,
      beforeState: {
        assignedOfficeRef: complaint.assignedOfficeRef,
        assignedStaffRef: complaint.assignedStaffRef,
        status: complaint.status,
      },
      afterState: { assignedOfficeRef: office._id, assignedStaffRef: target, status },
      createdAt: now,
    });
  }
  return summary;
}
module.exports = { centralizeOsas };
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  (async () => {
    if (process.env.NODE_ENV === "production")
      throw new Error("This development migration is disabled in production.");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
      await client.connect();
      console.log(
        JSON.stringify(
          await centralizeOsas(client.db(), {
            apply: process.argv.includes("--apply"),
            backupDirectory: path.join(process.cwd(), ".local-backups"),
          }),
        ),
      );
    } finally {
      await client.close();
    }
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
