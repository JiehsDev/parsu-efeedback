// vitest.config.ts — update to support this
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000, // mongodb-memory-server first boot can be slow
    include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
    exclude: [
      "**/node_modules/**",
      ".claude/**",
      "**/.claude/**",
      "tests/e2e/**",
      "**/*.spec.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
