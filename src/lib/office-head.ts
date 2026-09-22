// src/lib/office-head.ts
//
// Office Head authority is Office.headUserRef === currentUser._id, never a
// separate software role — this is the single source of truth for that
// check (previously duplicated, inconsistently, in manual-escalation.ts and
// archive-workflow.ts).
import { Office } from "@/models/Office";

export async function isOfficeHead(userId: string, officeId: unknown): Promise<boolean> {
  if (!officeId) return false;
  return Boolean(await Office.exists({ _id: officeId, headUserRef: userId, isActive: true }));
}
