// src/app/api/cron/sla-check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Complaint } from "@/models/Complaint";
import { ComplaintTimeline } from "@/models/ComplaintTimeline";
import { SLARule } from "@/models/SLARule";
import { writeAuditLog } from "@/features/audit-log/services/audit-log.service";
import { env } from "@/lib/env";
import type { ComplaintStatus } from "@/lib/constants";
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

export async function POST(req: NextRequest) {
  console.log("SLA cron fired"); // ← right here, first line inside POST

  const secret = req.headers.get("x-cron-secret");
  if (secret !== env.CRON_SECRET) {
    console.log("SLA cron rejected: bad secret", { received: secret }); // optional, but useful
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
    const dueAt = complaint.slaResolutionDueAt;
    if (!dueAt) continue;

    const isBreached = now >= dueAt;

    if (isBreached && !complaint.isOverdue) {
      const fromStatus = complaint.status;
      const fromOffice = complaint.assignedOfficeRef;

      const rule =
        (await SLARule.findOne({
          categoryRef: complaint.categoryRef,
          priority: complaint.priority,
          isActive: true,
        }).lean()) ??
        (await SLARule.findOne({
          categoryRef: null,
          priority: complaint.priority,
          isActive: true,
        }).lean());

      const update: Record<string, unknown> = {
        isOverdue: true,
        status: "escalated",
      };
      if ((rule as any)?.escalateToOfficeRef) {
        update.assignedOfficeRef = (rule as any).escalateToOfficeRef;
      }

      const updated = await Complaint.findByIdAndUpdate(complaint._id, update, {
        new: true,
      }).lean();

      await ComplaintTimeline.create({
        complaintRef: complaint._id,
        eventType: "escalated",
        actorRef: null,
        fromValue: fromStatus,
        toValue: "escalated",
        message: "SLA resolution deadline breached — auto-escalated",
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

      escalatedCount++;
      continue;
    }

    if (!isBreached && !complaint.lastWarningNotifiedAt) {
      const rule =
        (await SLARule.findOne({
          categoryRef: complaint.categoryRef,
          priority: complaint.priority,
          isActive: true,
        }).lean()) ??
        (await SLARule.findOne({
          categoryRef: null,
          priority: complaint.priority,
          isActive: true,
        }).lean());

      if (!rule) continue;

      const warningThreshold = (rule as any).warningThresholdPercent ?? 80;
      const totalMs = (rule as any).resolutionHours * 60 * 60 * 1000;
      const windowStart = new Date(dueAt.getTime() - totalMs);
      const elapsedPercent = ((now.getTime() - windowStart.getTime()) / totalMs) * 100;

      if (elapsedPercent >= warningThreshold) {
        await Complaint.findByIdAndUpdate(complaint._id, { lastWarningNotifiedAt: now });

        await ComplaintTimeline.create({
          complaintRef: complaint._id,
          eventType: "status_changed",
          actorRef: null,
          message: `SLA warning threshold (${warningThreshold}%) reached`,
        });

        await notifySlaWarning({
          staffId: complaint.assignedStaffRef ? String(complaint.assignedStaffRef) : null,
          ticketNumber: complaint.ticketNumber,
          complaintId: String(complaint._id),
          warningThresholdPercent: warningThreshold,
        });

        warnedCount++;
      }
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    escalated: escalatedCount,
    warned: warnedCount,
  });
}
