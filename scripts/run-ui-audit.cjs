/* eslint-disable @typescript-eslint/no-require-imports */
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

async function run() {
  const useBuild = process.env.UI_AUDIT_USE_BUILD === "1";
  if (useBuild && !fs.existsSync(".next/BUILD_ID"))
    throw new Error("Run npm run build before auditing the production build.");
  // Refuse an occupied port before contacting any seed endpoint.
  await new Promise((resolve, reject) => {
    const probe = require("node:net").createServer();
    probe.once("error", reject);
    probe.listen(3101, () => probe.close(resolve));
  });
  const mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [
      {
        dbName: "ui_audit",
        args: [
          "--setParameter",
          "indexBuildMinAvailableDiskSpaceMB=128",
          "--oplogSize",
          "16",
          "--wiredTigerCacheSizeGB",
          "0.25",
        ],
      },
    ],
  });
  fs.mkdirSync(".local-backups", { recursive: true });
  fs.writeFileSync(".local-backups/ui-audit-mongo.log", "");
  for (const member of mongo.servers) {
    const child = member.instanceInfo?.instance?.mongodProcess;
    child?.stdout?.on("data", (chunk) =>
      fs.appendFileSync(".local-backups/ui-audit-mongo.log", chunk),
    );
    child?.stderr?.on("data", (chunk) =>
      fs.appendFileSync(".local-backups/ui-audit-mongo.log", chunk),
    );
    child?.on("exit", (code, signal) =>
      console.log(`Isolated MongoDB exited (${code ?? signal}).`),
    );
  }
  const storage = await require("./ui-audit-storage.cjs").startStorage();
  const baseURL = "http://127.0.0.1:3101";
  const secret = randomBytes(32).toString("hex");
  const env = {
    ...process.env,
    NODE_ENV: "development",
    UI_AUDIT_ISOLATED: "1",
    UI_AUDIT_AUTH_DIR: path.join(
      process.cwd(),
      ".local-backups",
      `ui-audit-auth-${randomBytes(8).toString("hex")}`,
    ),
    MONGODB_URI: mongo.getUri(),
    NEXT_PUBLIC_APP_URL: baseURL,
    AUTH_URL: baseURL,
    AUTH_SECRET: secret,
    DEV_SEED_SECRET: secret,
    CRON_SECRET: secret,
    R2_ACCOUNT_ID: "ui-audit",
    R2_ACCESS_KEY_ID: "ui-audit",
    R2_SECRET_ACCESS_KEY: "ui-audit",
    R2_BUCKET_NAME: "ui-audit",
    R2_PUBLIC_URL: `${storage.url}/ui-audit`,
    UI_AUDIT_STORAGE_URL: storage.url,
    RESEND_API_KEY: "re_ui_audit_no_delivery",
    RESEND_FROM_EMAIL: "audit@example.test",
    RESEND_DEV_TEST_EMAIL: "audit@example.test",
    UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9",
    UPSTASH_REDIS_REST_TOKEN: "ui-audit",
    NODE_OPTIONS: `--require="${path.join(__dirname, "ui-audit-block-network.cjs").replaceAll("\\", "/")}"`,
  };
  fs.mkdirSync(".local-backups", { recursive: true });
  const log = fs.openSync(".local-backups/ui-audit-server.log", "w");
  let server = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "dev", "--webpack", "--port", "3101"],
    { env, windowsHide: true, stdio: ["ignore", log, log] },
  );
  let tests;
  try {
    const deadline = Date.now() + 180000;
    let ready = false;
    while (Date.now() < deadline && server.exitCode === null) {
      try {
        ready = (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(5000) })).ok;
      } catch {
        /* server compiling */
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready)
      throw new Error("Audit server failed to start; see .local-backups/ui-audit-server.log");
    const seeded = await fetch(`${baseURL}/api/dev/seed`, {
      headers: { "x-dev-seed-secret": secret },
    });
    if (!seeded.ok) throw new Error(`Isolated seed failed (${seeded.status})`);
    if (useBuild) {
      // Seed only through the development endpoint, then verify the existing
      // production build against the same isolated database without Fast Refresh.
      await new Promise((resolve) =>
        spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        }).on("exit", resolve),
      );
      server = spawn(
        process.execPath,
        [require.resolve("next/dist/bin/next"), "start", "--port", "3101"],
        {
          env: { ...env, NODE_ENV: "production", UI_AUDIT_PRODUCTION: "1" },
          windowsHide: true,
          stdio: ["ignore", log, log],
        },
      );
      const productionDeadline = Date.now() + 60000;
      let productionReady = false;
      while (Date.now() < productionDeadline && server.exitCode === null) {
        try {
          productionReady = (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(5000) }))
            .ok;
        } catch {
          /* starting */
        }
        if (productionReady) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!productionReady)
        throw new Error("Production audit server failed to start; see audit log.");
    }
    console.log("Isolated UI audit database ready; external email delivery blocked.");
    tests = spawn(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "--config",
        "playwright.ui-audit.config.ts",
        ...process.argv.slice(2),
      ],
      {
        env: { ...env, NODE_OPTIONS: "", PLAYWRIGHT_BASE_URL: baseURL },
        windowsHide: true,
        stdio: "inherit",
      },
    );
    process.exitCode = await new Promise((resolve) =>
      tests.on("exit", (code) => resolve(code ?? 1)),
    );
  } finally {
    tests?.kill();
    if (process.platform === "win32") {
      // Only the process tree started above is stopped; the user's dev server is untouched.
      await new Promise((resolve) =>
        spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        }).on("exit", resolve),
      );
    } else server.kill();
    fs.closeSync(log);
    await mongo.stop();
    await storage.close();
    // Next adds generated type directories for the temporary distDir.
    // Remove only this audit's entries, preserving other project settings.
    const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
    const tsconfig = fs.readFileSync(tsconfigPath, "utf8");
    fs.writeFileSync(
      tsconfigPath,
      tsconfig.replace(
        /,?\r?\n\s*"\.local-backups\/ui-audit-next\/(?:dev\/)?types\/\*\*\/\*\.ts"/g,
        "",
      ),
    );
  }
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
