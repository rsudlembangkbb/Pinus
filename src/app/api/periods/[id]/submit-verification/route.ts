import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { OPERATOR_ROLES, ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { notifyRole } from '@/lib/notify';

export const POST = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, OPERATOR_ROLES);

  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);
  if (period.status !== 'calculated') return jsonError('Periode harus berstatus "sudah dikalkulasi" sebelum diajukan verifikasi.', 409);

  const latestRun = await db
    .select()
    .from(schema.calculationRuns)
    .where(eq(schema.calculationRuns.periodId, resolvedParams.id));
  const officialRun = latestRun.filter((r) => !r.isSimulation && r.status === 'completed').sort((a, b) => b.runNumber - a.runNumber)[0];
  if (!officialRun) return jsonError('Belum ada hasil kalkulasi resmi (bukan simulasi) untuk periode ini.', 409);

  // Idempotent resubmission: clear any previous (possibly rejected) approval steps.
  const existingSteps = await db.select().from(schema.approvalSteps).where(eq(schema.approvalSteps.periodId, resolvedParams.id));
  for (const s of existingSteps) {
    await db.delete(schema.approvalSteps).where(eq(schema.approvalSteps.id, s.id));
  }

  const results = await db
    .select({ workUnitId: schema.employees.workUnitId })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.calculationResults.employeeId, schema.employees.id))
    .where(eq(schema.calculationResults.runId, officialRun.id));

  const unitIds = Array.from(new Set(results.map((r) => r.workUnitId).filter((v): v is string => Boolean(v))));

  for (const workUnitId of unitIds) {
    await db.insert(schema.approvalSteps).values({ id: newId('apr'), periodId: resolvedParams.id, stepType: 'verifikasi_unit', workUnitId, status: 'pending' });
  }
  await db.insert(schema.approvalSteps).values({ id: newId('apr'), periodId: resolvedParams.id, stepType: 'verifikasi_keuangan', status: 'pending' });
  await db.insert(schema.approvalSteps).values({ id: newId('apr'), periodId: resolvedParams.id, stepType: 'persetujuan_direktur', status: 'pending' });

  await db
    .update(schema.calculationPeriods)
    .set({ status: 'verifying_unit', updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.calculationPeriods.id, resolvedParams.id));

  await notifyRole(db, ROLES.VERIFIKATOR_UNIT, `Periode ${period.label} menunggu verifikasi Anda`, `Hasil perhitungan Jaspel periode ${period.label} untuk unit Anda sudah siap ditinjau.`, `/periods/${resolvedParams.id}`, unitIds);

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'submit_verification',
    entityType: 'calculation_period',
    entityId: resolvedParams.id,
    after: { unitCount: unitIds.length }
  });

  return jsonOk({ unitStepsCreated: unitIds.length });
});
