import { NextRequest } from 'next/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { ApiError, jsonOk, requireSession, withApi } from '@/lib/http';

/** Self-service transparency data for the logged-in employee (PRD 5.5.1). */
export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireSession();
  if (!session.employeeId) throw new ApiError(404, 'Akun Anda tidak terhubung ke data pegawai manapun.');

  const db = await getDb();
  const periods = await db
    .select()
    .from(schema.calculationPeriods)
    .where(inArray(schema.calculationPeriods.status, ['published', 'locked']))
    .orderBy(asc(schema.calculationPeriods.code));

  if (periods.length === 0) return jsonOk({ periods: [] });

  const allRuns = await db.select().from(schema.calculationRuns).where(inArray(schema.calculationRuns.periodId, periods.map((p) => p.id)));

  const officialRunByPeriod = new Map<string, string>();
  for (const periodEntry of periods) {
    const candidates = allRuns.filter((r) => r.periodId === periodEntry.id && !r.isSimulation && r.status === 'completed');
    const latest = candidates.sort((a, b) => b.runNumber - a.runNumber)[0];
    if (latest) officialRunByPeriod.set(periodEntry.id, latest.id);
  }

  const runIds = Array.from(officialRunByPeriod.values());
  const results = runIds.length
    ? await db
        .select()
        .from(schema.calculationResults)
        .where(inArray(schema.calculationResults.runId, runIds))
    : [];

  const resultByRunId = new Map(results.filter((r) => r.employeeId === session.employeeId).map((r) => [r.runId, r]));

  const history = periods
    .map((p) => {
      const runId = officialRunByPeriod.get(p.id);
      const result = runId ? resultByRunId.get(runId) : undefined;
      if (!result) return null;
      return {
        periodId: p.id,
        periodCode: p.code,
        periodLabel: p.label,
        grossAmount: result.grossAmount,
        deductionAmount: result.deductionAmount,
        minimumTopupAmount: result.minimumTopupAmount,
        paguAdjustmentAmount: result.paguAdjustmentAmount,
        netAmount: result.netAmount,
        isEstimate: result.isEstimate,
        breakdown: JSON.parse(result.componentBreakdownJson) as { label: string; amount: number }[]
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return jsonOk({ periods: history });
});
