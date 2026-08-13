import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { runCalculationEngine } from "../../domain/calculation-engine/engine.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { offsetFor, parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { gatherCalculationInput } from "./dataGathering.js";

export const calculationRoutes = new Hono<AppEnv>();
calculationRoutes.use("*", requireAuth);

calculationRoutes.post("/periods/:id/run", requirePermission("calculation.run"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period) throw Errors.notFound("Periode");
  if (period.status !== "DRAFT" && period.status !== "DIPROSES") {
    throw Errors.conflict("Kalkulasi hanya dapat dijalankan pada periode berstatus Draft atau Diproses");
  }

  const input = await gatherCalculationInput(db, period);
  const output = runCalculationEngine(input);

  await db.delete(schema.calculationResults).where(eq(schema.calculationResults.periodId, id));
  const rows = output.results.map((r) => ({
    id: newId(),
    periodId: id,
    employeeId: r.employeeId,
    engineKind: r.engineKind,
    grossAmount: r.grossAmount,
    deductionAmount: r.deductionAmount,
    deductionRuleCodesJson: JSON.stringify(r.deductionRuleCodes),
    minimumRequirementApplied: r.minimumRequirementApplied,
    minimumRequirementAmount: r.minimumRequirementAmount,
    adjustmentFactorBp: r.adjustmentFactorBp,
    netAmount: r.netAmount,
    componentsJson: JSON.stringify(r.components),
  }));
  const CHUNK = 30;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(schema.calculationResults).values(rows.slice(i, i + CHUNK));
  }

  await db
    .update(schema.calculationPeriods)
    .set({ status: "DIPROSES", calculatedAt: new Date().toISOString(), adjustmentFactorBp: output.adjustmentFactorBp })
    .where(eq(schema.calculationPeriods.id, id));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CALCULATE",
    entityType: "calculation_period",
    entityId: id,
    after: {
      resultCount: rows.length,
      totalBeforeAdjustment: output.totalBeforeAdjustment,
      totalAfterAdjustment: output.totalAfterAdjustment,
      adjustmentFactorBp: output.adjustmentFactorBp,
      paguExceeded: output.paguExceeded,
    },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  return c.json({
    resultCount: rows.length,
    totalBeforeAdjustment: output.totalBeforeAdjustment,
    totalAfterAdjustment: output.totalAfterAdjustment,
    adjustmentFactorBp: output.adjustmentFactorBp,
    paguExceeded: output.paguExceeded,
  });
});

calculationRoutes.post("/periods/:id/simulate", requirePermission("calculation.simulate"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period) throw Errors.notFound("Periode");

  const overrides = (await c.req.json().catch(() => ({}))) as {
    paguAmount?: number | null;
    administrasiAllocationAmount?: number | null;
    exemptMinimumFromAdjustment?: boolean;
  };

  const input = await gatherCalculationInput(db, period);
  if (overrides.paguAmount !== undefined) input.paguAmount = overrides.paguAmount;
  if (overrides.administrasiAllocationAmount !== undefined) input.administrasiAllocationAmount = overrides.administrasiAllocationAmount ?? 0;
  if (overrides.exemptMinimumFromAdjustment !== undefined) input.exemptMinimumFromAdjustment = overrides.exemptMinimumFromAdjustment;

  const output = runCalculationEngine(input);
  // simulation is never persisted -- PRD 5.3 item 7 "tanpa memengaruhi data final"
  return c.json(output);
});

calculationRoutes.get("/periods/:id/results", requirePermission("calculation.read"), async (c) => {
  const db = c.get("db");
  const { page, pageSize } = parsePagination(c);
  const periodId = c.req.param("id");
  const workUnitId = c.req.query("workUnitId");
  const engineKind = c.req.query("engineKind");

  let employeeIdsInUnit: string[] | null = null;
  if (workUnitId) {
    const rows = await db.select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.workUnitId, workUnitId));
    employeeIdsInUnit = rows.map((r) => r.id);
  }

  const conditions = [
    eq(schema.calculationResults.periodId, periodId),
    engineKind ? eq(schema.calculationResults.engineKind, engineKind) : undefined,
  ].filter(Boolean);

  const allResults = await db
    .select({
      result: schema.calculationResults,
      employeeName: schema.employees.fullName,
      employeeNip: schema.employees.nip,
      workUnitId: schema.employees.workUnitId,
    })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.employees.id, schema.calculationResults.employeeId))
    .where(and(...conditions));

  const filtered = employeeIdsInUnit ? allResults.filter((r) => employeeIdsInUnit!.includes(r.result.employeeId)) : allResults;
  const page_ = filtered.slice(offsetFor(page, pageSize), offsetFor(page, pageSize) + pageSize);

  return c.json({
    items: page_.map((r) => ({
      ...r.result,
      deductionRuleCodes: JSON.parse(r.result.deductionRuleCodesJson),
      components: JSON.parse(r.result.componentsJson),
      employeeName: r.employeeName,
      employeeNip: r.employeeNip,
      workUnitId: r.workUnitId,
    })),
    total: filtered.length,
    page,
    pageSize,
  });
});
