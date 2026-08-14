import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireSession, withApi } from '@/lib/http';

const STEP_ORDER_RANK: Record<string, number> = { verifikasi_unit: 0, verifikasi_keuangan: 1, persetujuan_direktur: 2 };

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  await requireSession();
  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);

  const batches = await db.select().from(schema.importBatches).where(eq(schema.importBatches.periodId, resolvedParams.id));
  const approvalStepsRaw = await db.select().from(schema.approvalSteps).where(eq(schema.approvalSteps.periodId, resolvedParams.id));
  const runs = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, resolvedParams.id));

  // SQLite/D1 gives no row-order guarantee without ORDER BY, so sort
  // explicitly by workflow stage (Verifikator Unit -> Keuangan -> Direktur)
  // rather than leaving the UI to render steps in an arbitrary DB order.
  const approvalSteps = approvalStepsRaw
    .slice()
    .sort((a, b) => (STEP_ORDER_RANK[a.stepType] ?? 99) - (STEP_ORDER_RANK[b.stepType] ?? 99));

  return jsonOk({ period, importBatches: batches, approvalSteps, calculationRuns: runs });
});
