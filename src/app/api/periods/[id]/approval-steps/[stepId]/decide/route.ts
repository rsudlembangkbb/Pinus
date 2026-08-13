import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb, schema, Db } from '@/db';
import { ApiError, jsonError, jsonOk, requireSession, withApi } from '@/lib/http';
import { ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit';
import { notifyRole } from '@/lib/notify';

const bodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional()
});

export const POST = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string; stepId: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError('Data tidak valid.', 422);

  const db = await getDb();
  const [step] = await db.select().from(schema.approvalSteps).where(eq(schema.approvalSteps.id, resolvedParams.stepId)).limit(1);
  if (!step || step.periodId !== resolvedParams.id) return jsonError('Tahap verifikasi tidak ditemukan.', 404);
  if (step.status !== 'pending') return jsonError('Tahap ini sudah diproses sebelumnya.', 409);

  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);

  authorizeStep(session, step);

  await db
    .update(schema.approvalSteps)
    .set({ status: parsed.data.decision, actorUserId: session.sub, notes: parsed.data.notes ?? null, actedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.approvalSteps.id, step.id));

  if (parsed.data.decision === 'rejected') {
    await db.update(schema.calculationPeriods).set({ status: 'calculated', updatedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.calculationPeriods.id, resolvedParams.id));
    await notifyRole(
      db,
      ROLES.ADMIN_JASPEL,
      `Periode ${period.label} dikembalikan`,
      `Tahap ${stepLabel(step.stepType)} mengembalikan periode ${period.label} untuk diperbaiki. Catatan: ${parsed.data.notes ?? '-'}`,
      `/periods/${resolvedParams.id}`
    );
  } else {
    await advanceWorkflow(db, resolvedParams.id, step, period, session);
  }

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: `approval_${parsed.data.decision}`,
    entityType: 'approval_step',
    entityId: step.id,
    after: { stepType: step.stepType, decision: parsed.data.decision, notes: parsed.data.notes }
  });

  return jsonOk({ success: true });
});

function authorizeStep(session: { role: string; workUnitId: string | null }, step: typeof schema.approvalSteps.$inferSelect) {
  if (step.stepType === 'verifikasi_unit') {
    if (session.role === ROLES.SUPER_ADMIN) return;
    if (session.role !== ROLES.VERIFIKATOR_UNIT || session.workUnitId !== step.workUnitId) {
      throw new ApiError(403, 'Anda tidak berwenang memverifikasi unit ini.');
    }
  } else if (step.stepType === 'verifikasi_keuangan') {
    if (![ROLES.KEUANGAN, ROLES.SUPER_ADMIN].includes(session.role as any)) throw new ApiError(403, 'Hanya Bagian Keuangan yang dapat memverifikasi tahap ini.');
  } else if (step.stepType === 'persetujuan_direktur') {
    if (![ROLES.DIREKTUR, ROLES.SUPER_ADMIN].includes(session.role as any)) throw new ApiError(403, 'Hanya Direktur yang dapat menyetujui tahap ini.');
  }
}

function stepLabel(stepType: string) {
  return { verifikasi_unit: 'Verifikasi Unit', verifikasi_keuangan: 'Verifikasi Keuangan', persetujuan_direktur: 'Persetujuan Direktur' }[stepType] ?? stepType;
}

async function advanceWorkflow(
  db: Db,
  periodId: string,
  step: typeof schema.approvalSteps.$inferSelect,
  period: typeof schema.calculationPeriods.$inferSelect,
  session: { sub: string }
) {
  if (step.stepType === 'verifikasi_unit') {
    const allUnitSteps = await db.select().from(schema.approvalSteps).where(and(eq(schema.approvalSteps.periodId, periodId), eq(schema.approvalSteps.stepType, 'verifikasi_unit')));
    const allApproved = allUnitSteps.every((s) => s.status === 'approved');
    if (allApproved) {
      await db.update(schema.calculationPeriods).set({ status: 'verifying_keuangan', updatedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.calculationPeriods.id, periodId));
      await notifyRole(db, ROLES.KEUANGAN, `Periode ${period.label} menunggu verifikasi Keuangan`, 'Seluruh unit telah memverifikasi. Silakan tinjau kesesuaian dengan pagu anggaran.', `/periods/${periodId}`);
    }
  } else if (step.stepType === 'verifikasi_keuangan') {
    await db.update(schema.calculationPeriods).set({ status: 'verifying_direktur', updatedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.calculationPeriods.id, periodId));
    await notifyRole(db, ROLES.DIREKTUR, `Periode ${period.label} menunggu persetujuan Anda`, 'Bagian Keuangan telah memverifikasi. Menunggu persetujuan akhir Direktur.', `/periods/${periodId}`);
  } else if (step.stepType === 'persetujuan_direktur') {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(schema.calculationPeriods)
      .set({ status: 'published', publishedAt: now, lockedAt: now, updatedAt: now })
      .where(eq(schema.calculationPeriods.id, periodId));
    await notifyRole(db, ROLES.ADMIN_JASPEL, `Periode ${period.label} terpublikasi`, 'Direktur telah menyetujui. Hasil Jaspel periode ini telah dikunci dan dapat diakses pegawai.', `/periods/${periodId}`);
  }
}
