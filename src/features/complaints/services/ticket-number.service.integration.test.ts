// src/features/complaints/services/ticket-number.service.integration.test.ts
// BR-100: "ticket number sequencing uses an atomic $inc counter specifically
// so concurrent submissions can never collide." The existing
// ticket-number.service.test.ts mocks Counter/Settings entirely, which
// can't actually prove atomicity under real concurrency — that requires a
// real (in-memory) MongoDB driving the same $inc against the same document,
// which is why this is a separate *.integration.test.ts file rather than
// an addition to the mocked unit-test file.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { generateTicketNumber } from "./ticket-number.service";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe("generateTicketNumber concurrency — BR-100", () => {
  it("3 concurrent calls via Promise.all produce 3 distinct ticket numbers", async () => {
    const [a, b, c] = await Promise.all([
      generateTicketNumber(),
      generateTicketNumber(),
      generateTicketNumber(),
    ]);

    const tickets = [a, b, c];
    expect(new Set(tickets).size).toBe(3);
  });

  it("20 concurrent calls all produce unique ticket numbers (stress the atomic $inc)", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => generateTicketNumber()),
    );
    expect(new Set(results).size).toBe(20);
  });
});
