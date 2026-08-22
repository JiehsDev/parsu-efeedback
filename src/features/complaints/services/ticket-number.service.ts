// src/features/complaints/services/ticket-number.service.ts
import { Counter } from "@/models/Counter";
import { getSettings } from "@/features/settings/services/settings.service";

export async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `ticketNumber:${year}`;

  const [counter, settings] = await Promise.all([
    Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    ),
    getSettings(),
  ]);

  const padded = String(counter.seq).padStart(6, "0");
  return `${settings.ticketNumberPrefix}-${year}-${padded}`;
}
