import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit';

export const POST = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, [ROLES.DIREKTUR, ROLES.SUPER_ADMIN]);

  const db = await getDb();
  const [correction] = await db.select().from(schema.calculationCorrections).where(eq(schema.calculationCorrections.id, resolvedParams.id)).limit(1);
  if (!correction) return jsonError('Koreksi tidak ditemukan.', 404);
  if (correction.status !== 'pending') return jsonError('Koreksi ini sudah diproses.', 409);

  await db
    .update(schema.calculationCorrections)
    .set({ status: 'applied', approvedBy: session.sub, approvedAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.calculationCorrections.id, resolvedParams.id));

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'approve', entityType: 'calculation_correction', entityId: resolvedParams.id });

  return jsonOk({ success: true });
});
