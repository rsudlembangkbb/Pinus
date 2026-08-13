import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { generateSlipPdf } from "../../lib/pdf.js";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const transparencyRoutes = new Hono<AppEnv>();
transparencyRoutes.use("*", requireAuth, requirePermission("self.dashboard.read"));

function requireEmployeeLink(user: { employeeId: string | null }): string {
  if (!user.employeeId) throw Errors.badRequest("Akun Anda belum ditautkan ke data pegawai. Hubungi Admin.");
  return user.employeeId;
}

transparencyRoutes.get("/me/history", async (c) => {
  const db = c.get("db");
  const user = currentUser(c);
  const employeeId = requireEmployeeLink(user);

  const rows = await db
    .select({ result: schema.calculationResults, period: schema.calculationPeriods })
    .from(schema.calculationResults)
    .innerJoin(schema.calculationPeriods, eq(schema.calculationPeriods.id, schema.calculationResults.periodId))
    .where(and(eq(schema.calculationResults.employeeId, employeeId), eq(schema.calculationPeriods.status, "FINAL")));

  rows.sort((a, b) => b.period.code.localeCompare(a.period.code));

  return c.json({
    items: rows.map((r) => ({
      periodId: r.period.id,
      periodCode: r.period.code,
      periodLabel: r.period.label,
      engineKind: r.result.engineKind,
      grossAmount: r.result.grossAmount,
      deductionAmount: r.result.deductionAmount,
      netAmount: r.result.netAmount,
    })),
  });
});

transparencyRoutes.get("/me/periods/:periodId", async (c) => {
  const db = c.get("db");
  const user = currentUser(c);
  const employeeId = requireEmployeeLink(user);
  const periodId = c.req.param("periodId");

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) });
  if (!period || period.status !== "FINAL") throw Errors.notFound("Rincian Jaspel");

  const result = await db.query.calculationResults.findFirst({
    where: and(eq(schema.calculationResults.periodId, periodId), eq(schema.calculationResults.employeeId, employeeId)),
  });
  if (!result) throw Errors.notFound("Rincian Jaspel");

  return c.json({
    period,
    result: {
      ...result,
      deductionRuleCodes: JSON.parse(result.deductionRuleCodesJson),
      components: JSON.parse(result.componentsJson),
    },
  });
});

transparencyRoutes.get("/me/periods/:periodId/slip.pdf", requirePermission("self.slip.download"), async (c) => {
  const db = c.get("db");
  const user = currentUser(c);
  const employeeId = requireEmployeeLink(user);
  const periodId = c.req.param("periodId");

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) });
  if (!period || period.status !== "FINAL") throw Errors.notFound("Slip Jaspel");

  const employee = await db.query.employees.findFirst({ where: eq(schema.employees.id, employeeId) });
  const workUnit = employee ? await db.query.workUnits.findFirst({ where: eq(schema.workUnits.id, employee.workUnitId) }) : null;
  const result = await db.query.calculationResults.findFirst({
    where: and(eq(schema.calculationResults.periodId, periodId), eq(schema.calculationResults.employeeId, employeeId)),
  });
  if (!employee || !result) throw Errors.notFound("Slip Jaspel");

  const pdfBytes = await generateSlipPdf({
    employee: { fullName: employee.fullName, nip: employee.nip, workUnitName: workUnit?.name ?? "-", category: employee.category },
    period: { label: period.label, code: period.code, status: period.status as never },
    result: {
      engineKind: result.engineKind as never,
      grossAmount: result.grossAmount,
      deductionAmount: result.deductionAmount,
      deductionRuleCodes: JSON.parse(result.deductionRuleCodesJson),
      minimumRequirementApplied: result.minimumRequirementApplied,
      minimumRequirementAmount: result.minimumRequirementAmount,
      adjustmentFactorBp: result.adjustmentFactorBp,
      netAmount: result.netAmount,
      components: JSON.parse(result.componentsJson),
    },
    generatedAt: new Date().toISOString(),
  });

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "EXPORT",
    entityType: "slip_jaspel",
    entityId: `${periodId}:${employeeId}`,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="slip-jaspel-${period.code}-${employee.nip}.pdf"`,
    },
  });
});
