import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui-audit",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 20000 },
  reporter: [["list"], ["json", { outputFile: ".local-backups/ui-audit-results.json" }]],
  outputDir: ".local-backups/ui-audit-artifacts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    viewport: { width: 1364, height: 900 },
    screenshot: "only-on-failure",
  },
});
