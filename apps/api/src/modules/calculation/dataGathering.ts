import { eq } from "drizzle-orm";
import { schema, type Database } from "../../db/client.js";
import type { CalculationEngineInput } from "../../domain/calculation-engine/types.js";

function isEffective(row: { effectiveFrom: string; effectiveTo: string | null; isActive: boolean }, ref: string): boolean {
  return row.isActive && row.effectiveFrom <= ref && (row.effectiveTo === null || row.effectiveTo > ref);
}

export async function gatherCalculationInput(
  db: Database,
  period: typeof schema.calculationPeriods.$inferSelect,
): Promise<CalculationEngineInput> {
  const referenceDate = `${period.code}-01`;

  const [employeeRows, workUnitRows, txRows, jobGradeRows, proportionRows, deductionRuleRows, minReqRows, indexingRows, attendanceRows, perfRows] =
    await Promise.all([
      db.select().from(schema.employees),
      db.select().from(schema.workUnits),
      db.select().from(schema.serviceTransactions).where(eq(schema.serviceTransactions.periodId, period.id)),
      db.select().from(schema.jobGrades),
      db.select().from(schema.proportionSchemes),
      db.select().from(schema.deductionRules),
      db.select().from(schema.minimumRequirements),
      db.select().from(schema.indexingWeights),
      db.select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.periodId, period.id)),
      db.select().from(schema.performanceScores).where(eq(schema.performanceScores.periodId, period.id)),
    ]);

  const workUnitById = new Map(workUnitRows.map((w) => [w.id, w]));

  return {
    employees: employeeRows.map((e) => ({
      id: e.id,
      category: e.category as CalculationEngineInput["employees"][number]["category"],
      profession: e.profession,
      workUnitId: e.workUnitId,
      jobGradeId: e.jobGradeId,
      isActive: e.isActive,
    })),
    transactions: txRows.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      workUnitId: t.workUnitId,
      serviceCategory: (workUnitById.get(t.workUnitId)?.serviceCategory ?? "RAWAT_INAP") as CalculationEngineInput["transactions"][number]["serviceCategory"],
      penjaminanStatus: t.penjaminanStatus as CalculationEngineInput["transactions"][number]["penjaminanStatus"],
      serviceRole: t.serviceRole as CalculationEngineInput["transactions"][number]["serviceRole"],
      tariffValue: t.tariffValue,
    })),
    proportionRules: proportionRows
      .filter((r) => isEffective(r, referenceDate))
      .map((r) => ({
        serviceCategory: r.serviceCategory as CalculationEngineInput["proportionRules"][number]["serviceCategory"],
        penjaminanStatus: r.penjaminanStatus as CalculationEngineInput["proportionRules"][number]["penjaminanStatus"],
        serviceRole: r.serviceRole as CalculationEngineInput["proportionRules"][number]["serviceRole"],
        percentBp: r.percentBp,
      })),
    jobGrades: jobGradeRows.map((g) => ({ id: g.id, weightBp: g.weightBp })),
    deductionRules: deductionRuleRows
      .filter((r) => isEffective(r, referenceDate))
      .map((r) => ({ code: r.code as CalculationEngineInput["deductionRules"][number]["code"], percentBp: r.percentBp })),
    employeeDeductions: attendanceRows
      .filter((a) => a.deductionRuleCode)
      .map((a) => ({
        employeeId: a.employeeId,
        ruleCode: a.deductionRuleCode as CalculationEngineInput["employeeDeductions"][number]["ruleCode"],
        overridePercentBp: a.disciplinaryPercentBp ?? undefined,
      })),
    minimumRequirements: minReqRows.filter((r) => isEffective(r, referenceDate)).map((r) => ({ professionKey: r.professionKey, minAmount: r.minAmount })),
    indexingWeights: indexingRows
      .filter((r) => isEffective(r, referenceDate))
      .map((r) => ({ variable: r.variable as CalculationEngineInput["indexingWeights"][number]["variable"], weightBp: r.weightBp, maxScore: r.maxScore })),
    performanceScores: perfRows.map((p) => ({
      employeeId: p.employeeId,
      variable: p.variable as CalculationEngineInput["performanceScores"][number]["variable"],
      score: p.score,
      attendanceScore: p.attendanceScore,
      qualityScore: p.qualityScore,
    })),
    administrasiAllocationAmount: period.administrasiAllocationAmount ?? 0,
    paguAmount: period.paguAmount ?? null,
    exemptMinimumFromAdjustment: period.exemptMinimumFromAdjustment,
  };
}
