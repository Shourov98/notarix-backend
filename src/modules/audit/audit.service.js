import crypto from "node:crypto";
import { AuditLogModel } from "./audit-log.model.js";

export const createAuditLog = async ({
  action,
  entityType,
  entityId,
  title,
  summary = "",
  actor = null,
  metadata = {},
}) => {
  const record = {
    id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    action,
    entityType,
    entityId,
    actorId: actor?.id || null,
    actorRole: actor?.role || null,
    actorType: actor?.type || null,
    title,
    summary,
    metadata,
  };

  await AuditLogModel.create(record);
  return record;
};
