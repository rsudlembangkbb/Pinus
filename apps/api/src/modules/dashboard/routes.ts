import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { Errors } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", requireAuth, requirePermission("dashboard.management.read"));

dashboardRoutes.get("/summary", async (c) => {
  const db = c.get("db");
  const periodId = c.req.query("periodId");

  const period = periodId
    ? await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) })
    : (await db.select().from(schema.calculationPeriods).orderBy(desc(schema.calculationPeriods.code)).limit(1))[0];
  if (!period) throw Errors.notFound("Periode");

  const rows = await db
    .select({ result: schema.calculationResults, employee: schema.employees, workUnit: schema.workUnits })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.employees.id, schema.calculationResults.employeeId))
    .innerJoin(schema.workUnits, eq(schema.workUnits.id, schema.employees.workUnitId))
    .where(eq(schema.calculationResults.periodId, period.id));

  const byCategory = new Map<string, { category: string; count: number; total: number }>();
  const byUnit = new Map<string, { unit: string; count: number; total: number }>();
  let totalGross = 0;
  let totalDeduction = 0;
  let totalNet = 0;

  for (const r of rows) {
    totalGross += r.result.grossAmount;
    totalDeduction += r.result.deductionAmount;
    totalNet += r.result.netAmount;

    const cat = byCategory.get(r.employee.category) ?? { category: r.employee.category, count: 0, total: 0 };
    cat.count += 1;
    cat.total += r.result.netAmount;
    byCategory.set(r.employee.category, cat);

    const unit = byUnit.get(r.workUnit.id) ?? { unit: r.workUnit.name, count: 0, total: 0 };
    unit.count += 1;
    unit.total += r.result.netAmount;
    byUnit.set(r.workUnit.id, unit);
  }

  return c.json({
    period,
    employeeCount: rows.length,
    totalGross,
    totalDeduction,
    totalNet,
    paguAmount: period.paguAmount,
    paguUtilizationBp: period.paguAmount ? Math.round((totalNet / period.paguAmount) * 10000) : null,
    byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
    byUnit: [...byUnit.values()].sort((a, b) => b.total - a.total),
  });
});

dashboardRoutes.get("/trend", async (c) => {
  const db = c.get("db");
  const months = Number(c.req.query("months") ?? "12");

  const periods = await db.select().from(schema.calculationPeriods).orderBy(desc(schema.calculationPeriods.code)).limit(months);

  const trend = [];
  for (const period of periods.reverse()) {
    const rows = await db
      .select({ netAmount: schema.calculationResults.netAmount })
      .from(schema.calculationResults)
      .where(eq(schema.calculationResults.periodId, period.id));
    trend.push({
      periodCode: period.code,
      periodLabel: period.label,
      status: period.status,
      totalNet: rows.reduce((s, r) => s + r.netAmount, 0),
      employeeCount: rows.length,
      paguAmount: period.paguAmount,
    });
  }

  return c.json({ items: trend });
});
