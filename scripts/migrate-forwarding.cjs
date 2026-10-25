/* eslint-disable @typescript-eslint/no-require-imports */
// Non-destructive development migration. Preview by default; --apply writes a backup first.
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, BSON } = require("mongodb");
const { centralizeOsas } = require("./centralize-osas.cjs");

/**
 * @param {import("mongodb").Db | import("mongoose").mongo.Db} db
 * @param {{ apply?: boolean, backupDirectory?: string }} [options]
 */
async function migrateForwarding(db, { apply = false, backupDirectory } = {}) {
  const routing = await centralizeOsas(db);
  const offices = await db
    .collection("offices")
    .find({ code: { $in: ["OVPAA", "OVPAF"] } })
    .toArray();
  const users = await db
    .collection("users")
    .find(
      { role: { $in: ["vpaa", "vpaf"] } },
      {
        projection: {
          _id: 1,
          role: 1,
          officeRef: 1,
          tokenVersion: 1,
          isActive: 1,
          forwardingPolicyVersion: 1,
        },
      },
    )
    .toArray();
  const summary = { routing, receivingAccounts: users.length, warnings: [], applied: false };
  for (const role of ["vpaa", "vpaf"])
    if (users.filter((user) => user.role === role && user.isActive).length !== 1)
      summary.warnings.push(
        `Configure the ${role.toUpperCase()} office head explicitly when there is not exactly one active account.`,
      );
  if (!apply) return summary;
  if (!backupDirectory)
    throw new Error("A backup directory is required when applying forwarding migration.");
  const resolved = path.resolve(backupDirectory);
  fs.mkdirSync(resolved, { recursive: true });
  fs.writeFileSync(
    path.join(resolved, `forwarding-accounts-${Date.now()}.json`),
    BSON.EJSON.stringify({ offices, users }, null, 2, { relaxed: false }),
    { flag: "wx" },
  );
  summary.routing = await centralizeOsas(db, { apply: true, backupDirectory: resolved });
  for (const [role, code, name] of [
    ["vpaa", "OVPAA", "Office of the Vice President for Academic Affairs"],
    ["vpaf", "OVPAF", "Office of the Vice President for Administration and Finance"],
  ]) {
    await db
      .collection("offices")
      .updateOne(
        { code },
        { $setOnInsert: { code, name, type: "university_office", isActive: true } },
        { upsert: true },
      );
    const office = await db.collection("offices").findOne({ code });
    const active = users.filter((user) => user.role === role && user.isActive);
    if (active.length === 1 && !office.headUserRef)
      await db
        .collection("offices")
        .updateOne({ _id: office._id }, { $set: { headUserRef: active[0]._id } });
    for (const user of users.filter((user) => user.role === role)) {
      if (user.forwardingPolicyVersion === 1) continue;
      await db.collection("users").updateOne(
        { _id: user._id, forwardingPolicyVersion: { $ne: 1 } },
        {
          $set: { officeRef: office._id, forwardingPolicyVersion: 1 },
          $inc: { tokenVersion: 1 },
        },
      );
    }
  }
  await db.collection("forwarding_requests").createIndex(
    { complaintRef: 1 },
    {
      unique: true,
      partialFilterExpression: { status: "pending" },
      name: "one_pending_forwarding",
    },
  );
  summary.applied = true;
  return summary;
}
module.exports = { migrateForwarding };
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
          await migrateForwarding(client.db(), {
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
