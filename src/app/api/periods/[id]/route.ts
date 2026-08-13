import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireSession, withApi } from '@/lib/http';

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  await requireSession();
  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);

  const batches = await db.select().from(schema.importBatches).where(eq(schema.importBatches.periodId, resolvedParams.id));
  const approvalSteps = await db.select().from(schema.approvalSteps).where(eq(schema.approvalSteps.periodId, resolvedParams.id));
  const runs = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, resolvedParams.id));

  return jsonOk({ period, importBatches: batches, approvalSteps, calculationRuns: runs });
});
