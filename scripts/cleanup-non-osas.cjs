/* eslint-disable @typescript-eslint/no-require-imports */
// Preview by default; --apply saves a local EJSON backup before cleanup.
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, BSON } = require("mongodb");
const { SEED_CATEGORIES } = require("../src/features/seed/categories.ts");

async function cleanupNonOsas(db, { apply = false, backupDirectory } = {}) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development cleanup is disabled in production.");
  const office = await db.collection("offices").findOne({ code: "OSAS", isActive: true });
  if (!office) throw new Error("An active OSAS office is required.");
  const names = SEED_CATEGORIES.map((category) => category.name);
  const categories = await db
    .collection("categories")
    .find({
      name: { $nin: names },
      domain: { $ne: "student_services" },
    })
    .toArray();
  const categoryIds = categories.map((category) => category._id);
  const complaints = await db
    .collection("complaints")
    .find({
      ticketNumber: /^DEMO-OSAS-/,
      $or: [{ categoryRef: { $in: categoryIds } }, { assignedOfficeRef: { $ne: office._id } }],
    })
    .toArray();
  const complaintIds = complaints.map((complaint) => complaint._id);
  const staff = await db
    .collection("users")
    .find({
      role: { $in: ["office_staff", "osas"] },
      officeRef: { $ne: office._id },
    })
    .toArray();
  const summary = {
    categoriesOutsideOsas: categories.length,
    demoComplaintsToRemove: complaints.length,
    staffOutsideOsas: staff.length,
    categoriesDeleted: 0,
    categoriesRetiredForHistory: 0,
    staffDeleted: 0,
    staffDisabledForHistory: 0,
  };
  if (!apply) return summary;
  if (!backupDirectory) throw new Error("A backup directory is required before cleanup.");
  const snapshot = {};
  for (const { name } of await db.listCollections().toArray()) {
    snapshot[name] = await db.collection(name).find({}).toArray();
  }
  fs.mkdirSync(backupDirectory, { recursive: true });
  summary.backupFile = path.join(backupDirectory, `non-osas-cleanup-${Date.now()}.json`);
  fs.writeFileSync(
    summary.backupFile,
    BSON.EJSON.stringify(snapshot, null, 2, { relaxed: false }),
    { flag: "wx" },
  );

  for (const name of [
    "assignments",
    "complaint_timeline",
    "complaint_notes",
    "information_requests",
    "archive_requests",
    "attachments",
  ]) {
    await db.collection(name).deleteMany({ complaintRef: { $in: complaintIds } });
  }
  await db.collection("notifications").deleteMany({ relatedComplaintRef: { $in: complaintIds } });
  await db
    .collection("audit_logs")
    .deleteMany({ entityType: "Complaint", entityId: { $in: complaintIds } });
  await db.collection("complaints").deleteMany({ _id: { $in: complaintIds } });
  await db.collection("routing_rules").deleteMany({ categoryRef: { $in: categoryIds } });
  await db.collection("sla_rules").deleteMany({ categoryRef: { $in: categoryIds } });
  for (const category of categories) {
    const referenced =
      (await db.collection("complaints").countDocuments({ categoryRef: category._id })) ||
      (await db
        .collection("generated_reports")
        .countDocuments({ "filters.categoryRef": category._id }));
    if (referenced) {
      await db
        .collection("categories")
        .updateOne({ _id: category._id }, { $set: { isActive: false, updatedAt: new Date() } });
      summary.categoriesRetiredForHistory++;
    } else {
      await db.collection("categories").deleteOne({ _id: category._id });
      summary.categoriesDeleted++;
    }
  }
  // Retain historical actor identities when they occur in surviving documents.
  function containsId(value, id) {
    if (!value || typeof value !== "object") return false;
    if (value._bsontype === "ObjectId") return String(value) === id;
    return Object.values(value).some((entry) => containsId(entry, id));
  }
  const history = [];
  for (const { name } of await db.listCollections().toArray()) {
    if (["users", "offices", "notifications", "password_reset_tokens"].includes(name)) continue;
    history.push(...(await db.collection(name).find({}).toArray()));
  }
  for (const user of staff) {
    await db.collection("notifications").deleteMany({ userRef: user._id });
    await db.collection("password_reset_tokens").deleteMany({ userRef: user._id });
    if (history.some((document) => containsId(document, String(user._id)))) {
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: { isActive: false, updatedAt: new Date() },
          $inc: { tokenVersion: 1 },
        },
      );
      summary.staffDisabledForHistory++;
    } else {
      await db
        .collection("offices")
        .updateMany({ headUserRef: user._id }, { $set: { headUserRef: null } });
      await db.collection("users").deleteOne({ _id: user._id });
      summary.staffDeleted++;
    }
  }
  return summary;
}
module.exports = { cleanupNonOsas };
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  (async () => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Development cleanup is disabled in production.");
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
      await client.connect();
      console.log(
        JSON.stringify(
          await cleanupNonOsas(client.db(), {
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
