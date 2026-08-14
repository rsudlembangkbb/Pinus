import { eq } from 'drizzle-orm';
import { getDb, schema, Db } from '@/db';
import { ApiError } from '@/lib/http';

export async function getPeriodOrThrow(db: Db, periodId: string) {
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, periodId)).limit(1);
  if (!period) throw new ApiError(404, 'Periode tidak ditemukan.');
  return period;
}

export async function getOfficialRunResults(db: Db, periodId: string) {
  const runs = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, periodId));
  const officialRun = runs.filter((r) => !r.isSimulation && r.status === 'completed').sort((a, b) => b.runNumber - a.runNumber)[0];
  if (!officialRun) return { run: null, rows: [] as Awaited<ReturnType<typeof queryRows>> };
  const rows = await queryRows(db, officialRun.id);
  return { run: officialRun, rows };
}

async function queryRows(db: Db, runId: string) {
  return db
    .select({
      resultId: schema.calculationResults.id,
      employeeId: schema.calculationResults.employeeId,
      employeeName: schema.employees.name,
      employeeNip: schema.employees.nip,
      category: schema.calculationResults.category,
      workUnitId: schema.employees.workUnitId,
      workUnitName: schema.workUnits.name,
      grossAmount: schema.calculationResults.grossAmount,
      deductionAmount: schema.calculationResults.deductionAmount,
      minimumTopupAmount: schema.calculationResults.minimumTopupAmount,
      paguAdjustmentAmount: schema.calculationResults.paguAdjustmentAmount,
      netAmount: schema.calculationResults.netAmount,
      isEstimate: schema.calculationResults.isEstimate,
      componentBreakdownJson: schema.calculationResults.componentBreakdownJson
    })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.calculationResults.employeeId, schema.employees.id))
    .leftJoin(schema.workUnits, eq(schema.employees.workUnitId, schema.workUnits.id))
    .where(eq(schema.calculationResults.runId, runId));
}
