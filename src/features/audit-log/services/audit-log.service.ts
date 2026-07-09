// src/features/audit-log/services/audit-log.service.ts
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { Types } from "mongoose";

interface WriteAuditLogParams {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | Types.ObjectId;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  await connectToDatabase();
  await AuditLog.create({
    actorRef: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeState: params.beforeState ?? null,
    afterState: params.afterState ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}