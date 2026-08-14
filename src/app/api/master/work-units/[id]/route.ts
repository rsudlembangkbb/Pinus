import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { MASTER_DATA_ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit';

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});

export const PATCH = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const [before] = await db.select().from(schema.workUnits).where(eq(schema.workUnits.id, resolvedParams.id)).limit(1);
  if (!before) return jsonError('Unit kerja tidak ditemukan.', 404);

  await db
    .update(schema.workUnits)
    .set({ ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.workUnits.id, resolvedParams.id));

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'update',
    entityType: 'work_unit',
    entityId: resolvedParams.id,
    before,
    after: parsed.data
  });

  return jsonOk({ id: resolvedParams.id });
});
