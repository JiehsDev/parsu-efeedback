// tests/e2e/fixtures.ts
//
// Role-scoped `test` wrappers, each pre-configured with the storageState
// saved by tests/e2e/auth.setup.ts. Import the one matching the role a spec
// needs to act as (a single spec file can import more than one — e.g.
// assign-scoping.spec.ts needs both staffTest and vpaaTest to prove
// cross-office/cross-college-office scoping).
//
// `storageState` is a built-in Playwright "option" fixture — overriding it
// with a plain path here is the documented way to give each exported `test`
// its own signed-in session without touching playwright.config.ts's
// projects.
import { test as base, expect } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, ".auth");

function roleTest(fileName: string) {
  return base.extend({
    storageState: path.join(AUTH_DIR, fileName),
  });
}

export const studentTest = roleTest("student.json");
export const staffTest = roleTest("staff.json");
export const adminTest = roleTest("admin.json");
export const vpaaTest = roleTest("vpaa.json");
export const vpafTest = roleTest("vpaf.json");
export const osasTest = roleTest("osas.json");

export { expect };
