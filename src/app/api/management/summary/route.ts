import { NextRequest } from 'next/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { FINANCE_VISIBILITY_ROLES } from '@/lib/auth/roles';

export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, FINANCE_VISIBILITY_ROLES);

  const db = await getDb();
  const periods = await db
    .select()
    .from(schema.calculationPeriods)
    .where(inArray(schema.calculationPeriods.status, ['published', 'locked']))
    .orderBy(asc(schema.calculationPeriods.code));

  if (periods.length === 0) return jsonOk({ trend: [], latestByUnit: [], latestByCategory: [] });

  const runs = await db.select().from(schema.calculationRuns).where(inArray(schema.calculationRuns.periodId, periods.map((p) => p.id)));

  const officialRunByPeriod = new Map<string, (typeof runs)[number]>();
  for (const p of periods) {
    const candidates = runs.filter((r) => r.periodId === p.id && !r.isSimulation && r.status === 'completed');
    const latest = candidates.sort((a, b) => b.runNumber - a.runNumber)[0];
    if (latest) officialRunByPeriod.set(p.id, latest);
  }

  const trend = periods.map((p) => {
    const run = officialRunByPeriod.get(p.id);
    return {
      periodCode: p.code,
      periodLabel: p.label,
      totalNetAmount: run?.totalNetAmount ?? 0,
      jaspelBudgetCap: p.jaspelBudgetCap
    };
  });

  const latestPeriod = periods[periods.length - 1]!;
  const latestRun = officialRunByPeriod.get(latestPeriod.id);

  let latestByUnit: { unit: string; total: number; count: number }[] = [];
  let latestByCategory: { category: string; total: number; count: number }[] = [];

  if (latestRun) {
    const results = await db
      .select({
        netAmount: schema.calculationResults.netAmount,
        category: schema.calculationResults.category,
        workUnitId: schema.employees.workUnitId,
        workUnitName: schema.workUnits.name
      })
      .from(schema.calculationResults)
      .innerJoin(schema.employees, eq(schema.calculationResults.employeeId, schema.employees.id))
      .leftJoin(schema.workUnits, eq(schema.employees.workUnitId, schema.workUnits.id))
      .where(eq(schema.calculationResults.runId, latestRun.id));

    const unitMap = new Map<string, { unit: string; total: number; count: number }>();
    const categoryMap = new Map<string, { category: string; total: number; count: number }>();
    for (const r of results) {
      const unitKey = r.workUnitName ?? 'Tanpa Unit';
      const unitEntry = unitMap.get(unitKey) ?? { unit: unitKey, total: 0, count: 0 };
      unitEntry.total += r.netAmount;
      unitEntry.count += 1;
      unitMap.set(unitKey, unitEntry);

      const catEntry = categoryMap.get(r.category) ?? { category: r.category, total: 0, count: 0 };
      catEntry.total += r.netAmount;
      catEntry.count += 1;
      categoryMap.set(r.category, catEntry);
    }
    latestByUnit = Array.from(unitMap.values()).sort((a, b) => b.total - a.total);
    latestByCategory = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
  }

  return jsonOk({ trend, latestPeriodLabel: latestPeriod.label, latestByUnit, latestByCategory });
});
