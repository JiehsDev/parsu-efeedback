/* eslint-disable @typescript-eslint/no-require-imports */
// Preview: npm run migrate:categories
// Apply:   npm run migrate:categories -- --apply
// This migration writes ONLY categories, routing_rules, and sla_rules.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { MongoClient, ObjectId, BSON } = require("mongodb");
const { CATEGORY_CATALOG } = require("../src/features/seed/categories.ts");
const { DEFAULT_SLA_HOURS } = require("../src/lib/constants.ts");

/**
 * @param {import('mongodb').Db | import('mongoose').mongo.Db} db
 * @param {{ apply?: boolean, backupDirectory?: string, categories?: readonly {name:string, description:string, domain:string, defaultPriority:string, group?:string, legacyNames?:readonly string[], historicalId?:string, historicalSlaId?:string}[] }} [options]
 */
async function migrateComplaintCategories(
  db,
  { apply = false, backupDirectory, categories = CATEGORY_CATALOG } = {},
) {
  const osas = await db.collection("offices").findOne({ code: "OSAS", isActive: true });
  if (!osas) throw new Error("An active OSAS office is required. No categories were changed.");
  const categoryCollection = db.collection("categories");
  const routeCollection = db.collection("routing_rules");
  const slaCollection = db.collection("sla_rules");
  const plans = [];
  const summary = {
    applied: false,
    created: 0,
    updated: 0,
    routesCreated: 0,
    routesUpdated: 0,
    slaCreated: 0,
    inactivePreserved: [],
    warnings: [],
    categories: [],
    backupFile: null,
  };
  const escape = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const same = (left, right) => String(left ?? "") === String(right ?? "");

  // Resolve every identity and collision before writing anything. Ambiguous
  // aliases are reported for review, never merged or deleted automatically.
  for (const definition of categories) {
    const names = [definition.name, ...(definition.legacyNames ?? [])];
    const matches = await categoryCollection
      .find({ name: { $in: names.map((name) => new RegExp(`^${escape(name)}$`, "i")) } })
      .toArray();
    if (matches.length > 1)
      throw new Error(
        `Multiple category records match ${definition.name}: ${matches.map((row) => String(row._id)).join(", ")}. Resolve the duplicate identities before migrating.`,
      );
    const existing = matches[0];
    const id =
      existing?._id ??
      (definition.historicalId ? new ObjectId(definition.historicalId) : new ObjectId());
    if (!existing && (await categoryCollection.findOne({ _id: id })))
      throw new Error(
        `Historical ID for ${definition.name} belongs to another category. No writes were attempted.`,
      );
    const routes = await routeCollection.find({ categoryRef: id }).toArray();
    const rules = await slaCollection.find({ categoryRef: id }).toArray();
    const route = routes.find((row) => row.isActive);
    const rule = rules.find((row) => row.isActive);
    if (
      routes.filter((row) => row.isActive).length > 1 ||
      rules.filter((row) => row.isActive).length > 1
    )
      throw new Error(
        `Multiple active configurations for ${definition.name}. No writes were attempted.`,
      );
    const slaId = definition.historicalSlaId
      ? new ObjectId(definition.historicalSlaId)
      : new ObjectId();
    if (!rules.length && (await slaCollection.findOne({ _id: slaId })))
      throw new Error(
        `Historical SLA ID for ${definition.name} is already in use. No writes were attempted.`,
      );
    const changes = {};
    if (existing) {
      if (existing.name !== definition.name) changes.name = definition.name;
      // Keep configured descriptions unless this is an explicitly renamed OSAS
      // service, whose expanded scope needs the new requested description.
      if (!existing.description || existing.name !== definition.name)
        changes.description = definition.description;
      if (!existing.domain) changes.domain = definition.domain;
      if (definition.group && existing.group !== definition.group) changes.group = definition.group;
      if (!same(existing.defaultOfficeRef, osas._id)) changes.defaultOfficeRef = osas._id;
      if (!existing.isActive) summary.inactivePreserved.push(definition.name);
    }
    const enabled = existing ? existing.isActive === true : true;
    const createRoute = enabled && !routes.length;
    const updateRoute = enabled && route && !same(route.targetOfficeRef, osas._id);
    const createSla = enabled && !rules.length;
    if (enabled && routes.length && !route)
      summary.warnings.push(
        `${definition.name}: inactive routing configurations retained; configure routing before enabling submissions.`,
      );
    if (enabled && rules.length && !rule)
      summary.warnings.push(
        `${definition.name}: inactive SLA configurations retained; configure SLA settings before enabling submissions.`,
      );
    const priority = existing?.defaultPriority ?? definition.defaultPriority;
    if (!DEFAULT_SLA_HOURS[priority]) throw new Error(`Invalid priority for ${definition.name}.`);
    if (rule && rule.priority !== priority)
      summary.warnings.push(
        `${definition.name}: existing SLA priority mismatch retained for administrator review.`,
      );
    if (!existing) summary.created++;
    else if (Object.keys(changes).length) summary.updated++;
    if (createRoute) summary.routesCreated++;
    if (updateRoute) summary.routesUpdated++;
    if (createSla) summary.slaCreated++;
    plans.push({
      definition,
      existing,
      id,
      changes,
      priority,
      createRoute,
      updateRoute,
      route,
      createSla,
      slaId,
    });
    summary.categories.push({
      id: String(id),
      name: definition.name,
      group: definition.group ?? existing?.group ?? null,
      action: !existing ? "create" : Object.keys(changes).length ? "update" : "unchanged",
      active: enabled,
    });
  }
  if (!apply) return summary;
  const writes =
    summary.created +
    summary.updated +
    summary.routesCreated +
    summary.routesUpdated +
    summary.slaCreated;
  if (writes) {
    if (!backupDirectory)
      throw new Error(
        "A configuration backup directory is required before applying category changes.",
      );
    const ids = plans.map((plan) => plan.id);
    const snapshot = {
      createdAt: new Date(),
      categories: await categoryCollection.find({ _id: { $in: ids } }).toArray(),
      routing_rules: await routeCollection.find({ categoryRef: { $in: ids } }).toArray(),
      sla_rules: await slaCollection.find({ categoryRef: { $in: ids } }).toArray(),
      plannedCategories: summary.categories,
    };
    fs.mkdirSync(backupDirectory, { recursive: true });
    summary.backupFile = path.join(
      backupDirectory,
      `category-catalog-${Date.now()}-${randomUUID()}.json`,
    );
    fs.writeFileSync(
      summary.backupFile,
      BSON.EJSON.stringify(snapshot, null, 2, { relaxed: false }),
      { flag: "wx" },
    );
  }
  for (const plan of plans) {
    const { definition, id, existing, priority } = plan;
    const now = new Date();
    if (!existing) {
      // Provision as a draft, then publish only after both configurations exist.
      const result = await categoryCollection.updateOne(
        { name: definition.name },
        {
          $setOnInsert: {
            _id: id,
            name: definition.name,
            description: definition.description,
            domain: definition.domain,
            group: definition.group ?? null,
            defaultPriority: priority,
            defaultOfficeRef: osas._id,
            isActive: false,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      if (!result.upsertedId)
        throw new Error(
          `Category catalog changed concurrently. Rerun the migration for ${definition.name}.`,
        );
    } else if (Object.keys(plan.changes).length) {
      await categoryCollection.updateOne(
        { _id: id },
        { $set: { ...plan.changes, updatedAt: now } },
      );
    }
    if (plan.createRoute)
      await routeCollection.updateOne(
        { categoryRef: id, isActive: true },
        {
          $setOnInsert: {
            categoryRef: id,
            targetOfficeRef: osas._id,
            conditions: {},
            priority: 0,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    if (plan.updateRoute)
      await routeCollection.updateOne(
        { _id: plan.route._id, isActive: true },
        { $set: { targetOfficeRef: osas._id, updatedAt: now } },
      );
    if (plan.createSla)
      await slaCollection.updateOne(
        { categoryRef: id, isActive: true },
        {
          $setOnInsert: {
            _id: plan.slaId,
            categoryRef: id,
            priority,
            ...DEFAULT_SLA_HOURS[priority],
            warningThresholdPercent: 80,
            escalateToOfficeRef: null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    if (!existing)
      await categoryCollection.updateOne(
        { _id: id, isActive: false },
        { $set: { isActive: true } },
      );
  }
  summary.applied = true;
  return summary;
}
module.exports = { migrateComplaintCategories };
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  (async () => {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
      await client.connect();
      console.log(
        JSON.stringify(
          await migrateComplaintCategories(client.db(), {
            apply: process.argv.includes("--apply"),
            backupDirectory: path.resolve(".local-backups/category-catalog"),
          }),
          null,
          2,
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
