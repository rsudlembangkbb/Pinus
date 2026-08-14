import { getDb, schema } from '@/db';
import { newId } from '@/lib/ids';

interface AuditParams {
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

/**
 * Records an immutable audit trail entry. Called from every mutating API
 * route (master data changes, imports, calculation runs, approval
 * decisions) per PRD 5.7.3 - "siapa mengubah apa, kapan, nilai
 * sebelum/sesudah".
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  const db = await getDb();
  await db.insert(schema.auditLogs).values({
    id: newId('aud'),
    actorUserId: params.actorUserId ?? null,
    actorName: params.actorName ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    beforeJson: params.before !== undefined ? JSON.stringify(params.before) : null,
    afterJson: params.after !== undefined ? JSON.stringify(params.after) : null,
    ipAddress: params.ipAddress ?? null
  });
}
