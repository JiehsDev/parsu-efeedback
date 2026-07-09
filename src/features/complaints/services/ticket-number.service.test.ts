// src/features/complaints/services/ticket-number.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { generateTicketNumber } from "./ticket-number.service";
import { Counter } from "@/models/Counter";

vi.mock("@/models/Counter");
vi.mock("@/lib/env", () => ({ env: { TICKET_NUMBER_PREFIX: "PARSU" } }));

describe("ticket-number.service — BR-036/BR-100", () => {
  it("BR-036: produces the documented format PREFIX-YYYY-NNNNNN", async () => {
    (Counter.findOneAndUpdate as any).mockResolvedValue({ seq: 1 });

    const ticket = await generateTicketNumber();
    const year = new Date().getFullYear();

    expect(ticket).toBe(`PARSU-${year}-000001`);
  });

  it("BR-100: sequence increments atomically via $inc, never reused", async () => {
    (Counter.findOneAndUpdate as any).mockResolvedValueOnce({ seq: 5 });
    const ticket = await generateTicketNumber();
    expect(ticket).toContain("000005");

    expect(Counter.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      { $inc: { seq: 1 } },
      expect.objectContaining({ upsert: true }),
    );
  });
});
