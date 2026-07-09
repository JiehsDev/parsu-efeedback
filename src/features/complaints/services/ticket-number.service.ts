// src/features/complaints/services/ticket-number.service.ts
import { Counter } from "@/models/Counter";
import { env } from "@/lib/env";

export async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `ticketNumber:${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }, // ← was { upsert: true, new: true }
  );

  const padded = String(counter.seq).padStart(6, "0");
  return `${env.TICKET_NUMBER_PREFIX}-${year}-${padded}`;
}
