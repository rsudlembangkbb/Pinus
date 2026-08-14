import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { OPERATOR_ROLES, ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { notifyRole } from '@/lib/notify';

const createSchema = z.object({
  sourcePeriodId: z.string().min(1),
  targetPeriodId: z.string().min(1),
  employeeId: z.string().min(1),
  reason: z.string().min(5),
  correctedAmount: z.number().int(),
  relatedBpjsClaimNumber: z.string().optional()
});

/**
 * Corrections record adjustments to an already-locked (published) period -
 * e.g. a JKN claim that was estimated as pending later turns out
 * cair/ditolak (PRD 9.6 / 4.22). They are proposed by Admin Jaspel and
 * require Direktur/Super Admin authorization before taking effect,
 * matching the "otorisasi ulang" requirement - locked period data itself
 * is never mutated, only appended to.
 */
export const GET = withApi(async (req: NextRequest) => {
  await requireSession();
  const db = await getDb();
  const periodId = req.nextUrl.searchParams.get('periodId');
  const rows = periodId
    ? await db
        .select()
        .from(schema.calculationCorrections)
        .where(and(eq(schema.calculationCorrections.sourcePeriodId, periodId)))
        .orderBy(desc(schema.calculationCorrections.createdAt))
    : await db.select().from(schema.calculationCorrections).orderBy(desc(schema.calculationCorrections.createdAt)).limit(200);
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, OPERATOR_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const [sourcePeriod] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, parsed.data.sourcePeriodId)).limit(1);
  if (!sourcePeriod || sourcePeriod.status !== 'published' && sourcePeriod.status !== 'locked') {
    return jsonError('Koreksi hanya dapat diajukan atas periode yang sudah terpublikasi/terkunci.', 409);
  }

  const runs = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, parsed.data.sourcePeriodId));
  const officialRun = runs.filter((r) => !r.isSimulation && r.status === 'completed').sort((a, b) => b.runNumber - a.runNumber)[0];
  if (!officialRun) return jsonError('Tidak ditemukan hasil resmi pada periode sumber.', 409);

  const [result] = await db
    .select()
    .from(schema.calculationResults)
    .where(and(eq(schema.calculationResults.runId, officialRun.id), eq(schema.calculationResults.employeeId, parsed.data.employeeId)))
    .limit(1);
  if (!result) return jsonError('Tidak ditemukan hasil perhitungan pegawai ini pada periode sumber.', 404);

  const id = newId('cor');
  const deltaAmount = parsed.data.correctedAmount - result.netAmount;
  await db.insert(schema.calculationCorrections).values({
    id,
    sourcePeriodId: parsed.data.sourcePeriodId,
    targetPeriodId: parsed.data.targetPeriodId,
    employeeId: parsed.data.employeeId,
    reason: parsed.data.reason,
    originalAmount: result.netAmount,
    correctedAmount: parsed.data.correctedAmount,
    deltaAmount,
    relatedBpjsClaimNumber: parsed.data.relatedBpjsClaimNumber ?? null,
    status: 'pending',
    createdBy: session.sub
  });

  await notifyRole(db, ROLES.DIREKTUR, 'Pengajuan koreksi Jaspel', `Ada pengajuan koreksi senilai ${deltaAmount} untuk periode ${sourcePeriod.label}. Alasan: ${parsed.data.reason}`, '/periods');

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'create', entityType: 'calculation_correction', entityId: id, after: parsed.data });

  return jsonOk({ id }, 201);
});
