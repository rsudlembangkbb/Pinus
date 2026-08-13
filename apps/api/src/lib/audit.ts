import type { AuditAction } from "@pinus/shared";
import type { Context } from "hono";
import { schema, type Database } from "../db/client.js";
import { newId } from "./ids.js";

export interface RecordAuditInput {
  actorUserId: string | null;
  actorName: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Every mutating handler calls this explicitly (rather than relying on a
 * blanket ORM hook) so the before/after snapshots are always the
 * domain-meaningful values, not raw SQL diffs. audit_logs rows are never
 * updated or deleted by application code -- the table has no UPDATE/DELETE
 * route anywhere in the API, which is what keeps the trail immutable.
 */
export async function recordAudit(db: Database, input: RecordAuditInput): Promise<void> {
  await db.insert(schema.auditLogs).values({
    id: newId(),
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    beforeJson: input.before === undefined ? null : JSON.stringify(input.before),
    afterJson: input.after === undefined ? null : JSON.stringify(input.after),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

export function clientIp(c: Context): string | null {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null;
}

export function clientUserAgent(c: Context): string | null {
  return c.req.header("user-agent") ?? null;
}
