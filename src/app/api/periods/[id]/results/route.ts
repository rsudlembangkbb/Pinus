import { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema, Db } from '@/db';
import { jsonError, jsonOk, requireSession, withApi, ApiError } from '@/lib/http';
import { FINANCE_VISIBILITY_ROLES, ROLES } from '@/lib/auth/roles';

async function latestRunId(db: Db, periodId: string, includeSimulation: boolean) {
  const runs = await db
    .select()
    .from(schema.calculationRuns)
    .where(eq(schema.calculationRuns.periodId, periodId))
    .orderBy(desc(schema.calculationRuns.runNumber));
  const run = runs.find((r) => r.status === 'completed' && (includeSimulation || !r.isSimulation));
  return run?.id ?? null;
}

export const GET = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  const db = await getDb();

  const runIdParam = req.nextUrl.searchParams.get('runId');
  const runId = runIdParam ?? (await latestRunId(db, resolvedParams.id, false));
  if (!runId) return jsonOk({ runId: null, results: [] });

  const results = await db
    .select({
      id: schema.calculationResults.id,
      employeeId: schema.calculationResults.employeeId,
      category: schema.calculationResults.category,
      grossAmount: schema.calculationResults.grossAmount,
      deductionAmount: schema.calculationResults.deductionAmount,
      minimumTopupAmount: schema.calculationResults.minimumTopupAmount,
      paguAdjustmentAmount: schema.calculationResults.paguAdjustmentAmount,
      netAmount: schema.calculationResults.netAmount,
      isEstimate: schema.calculationResults.isEstimate,
      employeeName: schema.employees.name,
      employeeNip: schema.employees.nip,
      workUnitId: schema.employees.workUnitId,
      workUnitName: schema.workUnits.name
    })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.calculationResults.employeeId, schema.employees.id))
    .leftJoin(schema.workUnits, eq(schema.employees.workUnitId, schema.workUnits.id))
    .where(eq(schema.calculationResults.runId, runId));

  let scoped = results;
  if (session.role === ROLES.VERIFIKATOR_UNIT) {
    scoped = results.filter((r) => r.workUnitId === session.workUnitId);
  } else if (session.role === ROLES.PEGAWAI) {
    scoped = results.filter((r) => r.employeeId === session.employeeId);
  } else if (!FINANCE_VISIBILITY_ROLES.includes(session.role as any) && session.role !== ROLES.VERIFIKATOR_UNIT) {
    throw new ApiError(403, 'Anda tidak memiliki wewenang untuk melihat data ini.');
  }

  return jsonOk({ runId, results: scoped });
});
