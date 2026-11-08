// src/features/audit-log/services/audit-log.service.ts
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { Types, type ClientSession } from "mongoose";

interface WriteAuditLogParams {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | Types.ObjectId;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  session?: ClientSession;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  await connectToDatabase();
  const entry = {
    actorRef: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeState: params.beforeState ?? null,
    afterState: params.afterState ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  };
  if (params.session) {
    await AuditLog.create([entry], { session: params.session });
  } else {
    await AuditLog.create(entry);
  }
}
