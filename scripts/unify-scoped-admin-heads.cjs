/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Aligns existing development data with the unified scoped-admin/head rule.
 *
 * Dry run (default): node scripts/unify-scoped-admin-heads.cjs
 * Apply changes:     node scripts/unify-scoped-admin-heads.cjs --apply
 *
 * This script never deletes or deactivates users. It only sets officeRef on
 * the three canonical scoped accounts and points the matching office's
 * headUserRef at that same account.
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function readLocalEnv() {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

readLocalEnv();
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");

const APPLY = process.argv.includes("--apply");
const mappings = [
  { role: "vpaa", email: "vpaa@parsu.edu.ph", officeCode: "OVPAA" },
  { role: "vpaf", email: "vpaf@parsu.edu.ph", officeCode: "OVPAF" },
  { role: "osas", email: "osas@parsu.edu.ph", officeCode: "OSAS" },
];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const users = db.collection("users");
    const offices = db.collection("offices");

    for (const mapping of mappings) {
      const user = await users.findOne({ email: mapping.email, role: mapping.role });
      const office = await offices.findOne({ code: mapping.officeCode });
      if (!user || !office) {
        console.log(`[missing] ${mapping.role}: user=${Boolean(user)} office=${Boolean(office)}`);
        continue;
      }

      const userNeedsOffice = String(user.officeRef ?? "") !== String(office._id);
      const officeNeedsHead = String(office.headUserRef ?? "") !== String(user._id);
      console.log(
        `[${APPLY ? "apply" : "dry-run"}] ${mapping.role}: ` +
          `officeRef=${userNeedsOffice ? "update" : "ok"}, ` +
          `headUserRef=${officeNeedsHead ? "update" : "ok"}`,
      );

      if (APPLY) {
        if (userNeedsOffice) await users.updateOne({ _id: user._id }, { $set: { officeRef: office._id } });
        if (officeNeedsHead) await offices.updateOne({ _id: office._id }, { $set: { headUserRef: user._id } });
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
