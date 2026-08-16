// src/app/api/cron/sla-check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { SLARule } from "@/models/SLARule";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { env } from "@/lib/env";
import type { ComplaintStatus, PriorityLevel } from "@/lib/constants";
import {
  notifySlaWarning,
  notifyEscalation,
} from "@/features/notifications/services/notification.service";

const ACTIVE_STATUSES: ComplaintStatus[] = [
  "submitted",
  "assigned",
  "in_progress",
  "pending_information",
  "escalated",
];

type Clock = "response" | "resolution";

async function resolveSlaRule(categoryRef: string | Types.ObjectId, priority: PriorityLevel) {
  return (
    (await SLARule.findOne({ categoryRef, priority, isActive: true }).lean()) ??
    (await SLARule.findOne({ categoryRef: null, priority, isActive: true }).lean())
  );
}

/**
 * Evaluates one complaint against one SLA clock (BR-030 first-response or
 * BR-031 resolution). Both clocks get identical treatment per
 * docs/architecture.md section 8: breach escalates, threshold-crossing
 * warns once (idempotency tracked per-clock via `warningField`).
 */
async function checkDeadline(
  complaint: any,
  dueAt: Date | null,
  clock: Clock,
  warningField: "lastWarningNotifiedAt" | "lastResponseWarningNotifiedAt",
  now: Date,
): Promise<{ escalated: boolean; warned: boolean }> {
  if (!dueAt) return { escalated: false, warned: false };

  const isBreached = now >= dueAt;

  if (isBreached) {
    const fromStatus = complaint.status;
    const fromOffice = complaint.assignedOfficeRef;

    const rule = await resolveSlaRule(complaint.categoryRef, complaint.priority);

    const update: Record<string, unknown> = { isOverdue: true, status: "escalated" };
    if ((rule as any)?.escalateToOfficeRef) {
      update.assignedOfficeRef = (rule as any).escalateToOfficeRef;
    }

    // Atomic claim: the `isOverdue: false` condition is re-checked here at
    // write time, not just in the caller's stale in-memory snapshot. If a
    // concurrent invocation (e.g. an overlapping QStash retry) already won
    // this complaint, this returns null and we skip the timeline/audit/
    // notification side effects below instead of duplicating them.
    const updated = await Complaint.findOneAndUpdate(
      { _id: complaint._id, isOverdue: false },
      update,
      { new: true },
    ).lean();

    if (!updated) return { escalated: false, warned: false };

    await ComplaintTimeline.create({
      complaintRef: complaint._id,
      eventType: "escalated",
      actorRef: null,
      fromValue: fromStatus,
      toValue: "escalated",
      message:
        clock === "response"
          ? "SLA first-response deadline breached — auto-escalated"
          : "SLA resolution deadline breached — auto-escalated",
    });

    await writeAuditLog({
      actorId: null,
      action: "complaint.sla_escalate",
      entityType: "Complaint",
      entityId: complaint._id,
      beforeState: { status: fromStatus, assignedOfficeRef: fromOffice },
      afterState: {
        status: "escalated",
        assignedOfficeRef: (updated as any)?.assignedOfficeRef,
      },
    });

    await notifyEscalation({
      staffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
      ticketNumber: complaint.ticketNumber,
      complaintId: String(complaint._id),
    });

    return { escalated: true, warned: false };
  }

  if (complaint[warningField]) return { escalated: false, warned: false };

  const rule = await resolveSlaRule(complaint.categoryRef, complaint.priority);
  if (!rule) return { escalated: false, warned: false };

  const warningThreshold = (rule as any).warningThresholdPercent ?? 80;
  const clockHours = clock === "response" ? (rule as any).responseHours : (rule as any).resolutionHours;
  const totalMs = clockHours * 60 * 60 * 1000;
  const windowStart = new Date(dueAt.getTime() - totalMs);
  const elapsedPercent = ((now.getTime() - windowStart.getTime()) / totalMs) * 100;

  if (elapsedPercent < warningThreshold) return { escalated: false, warned: false };

  // Same atomic-claim reasoning as the escalation branch above: only
  // proceed if this run is the one that actually flips warningField from
  // unset, so a concurrent overlapping run can't send the warning twice.
  const claimed = await Complaint.findOneAndUpdate(
    { _id: complaint._id, [warningField]: null },
    { [warningField]: now },
  );
  if (!claimed) return { escalated: false, warned: false };

  await ComplaintTimeline.create({
    complaintRef: complaint._id,
    eventType: "status_changed",
    actorRef: null,
    message: `SLA ${clock === "response" ? "first-response" : "resolution"} warning threshold (${warningThreshold}%) reached`,
  });

  await notifySlaWarning({
    staffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
    ticketNumber: complaint.ticketNumber,
    complaintId: String(complaint._id),
    warningThresholdPercent: warningThreshold,
  });

  return { escalated: false, warned: true };
}

// Vercel Cron Jobs (configured in vercel.json) trigger via GET; Upstash
// QStash and manual/external triggers use POST. Both run the same check.
export async function GET(req: NextRequest) {
  return runSlaCheck(req);
}

export async function POST(req: NextRequest) {
  return runSlaCheck(req);
}

async function runSlaCheck(req: NextRequest) {
  // Accepts either a custom header (Upstash QStash, manual triggers) or a
  // bearer token (Vercel Cron Jobs send `Authorization: Bearer $CRON_SECRET`
  // automatically for schedules defined in vercel.json).
  const headerSecret = req.headers.get("x-cron-secret");
  const bearerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerSecret !== env.CRON_SECRET && bearerSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const now = new Date();

  const candidates = await Complaint.find({
    status: { $in: ACTIVE_STATUSES },
    isArchived: false,
  }).lean();

  let escalatedCount = 0;
  let warnedCount = 0;

  for (const complaint of candidates) {
    if ((complaint as any).isOverdue) continue;

    const resolutionResult = await checkDeadline(
      complaint,
      (complaint as any).slaResolutionDueAt,
      "resolution",
      "lastWarningNotifiedAt",
      now,
    );
    if (resolutionResult.escalated) {
      escalatedCount++;
      continue; // already escalated this run — resolution breach takes priority
    }
    if (resolutionResult.warned) warnedCount++;

    // BR-030 first-response deadline — a separate clock from resolution,
    // only meaningful if nobody has actually picked the complaint up yet.
    if (!(complaint as any).assignedStaffRef) {
      const responseResult = await checkDeadline(
        complaint,
        (complaint as any).slaResponseDueAt,
        "response",
        "lastResponseWarningNotifiedAt",
        now,
      );
      if (responseResult.escalated) escalatedCount++;
      if (responseResult.warned) warnedCount++;
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    escalated: escalatedCount,
    warned: warnedCount,
  });
}
