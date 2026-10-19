/* eslint-disable @typescript-eslint/no-require-imports */
// Preview: node scripts/rename-teaching-categories.cjs
// Apply:   node scripts/rename-teaching-categories.cjs --apply
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");

loadEnvConfig(process.cwd());

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const categories = client.db().collection("categories");
    const matches = await categories
      .find({ name: /^Faculty & (?:Teaching|Non-Teaching) Performance(?: - .+)?$/ })
      .project({ name: 1 })
      .toArray();
    const changes = matches.map((category) => ({
      ...category,
      newName: category.name.replace(/^Faculty & (?:Teaching|Non-Teaching) Performance/, "Faculty & Non Teaching Performance"),
    }));
    // Check every target before writing so an existing name cannot cause a partial rename.
    for (const change of changes) {
      if (await categories.findOne({ name: change.newName })) {
        throw new Error(`Category already exists: ${change.newName}`);
      }
    }
    const apply = process.argv.includes("--apply");
    for (const change of changes) {
      if (apply) {
        await categories.updateOne(
          { _id: change._id, name: change.name },
          { $set: { name: change.newName, updatedAt: new Date() } },
        );
      }
      console.log(`[${apply ? "apply" : "preview"}] ${change.name} -> ${change.newName}`);
    }
    console.log(`${changes.length} categories ${apply ? "renamed" : "to rename"}.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
