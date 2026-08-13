import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { OPERATOR_ROLES, ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { runCalculationEngine } from '@/domain/calculation/engine';
import { resolveJknTransactionValue, BpjsClaimStatus } from '@/domain/calculation/bpjs-policy';
import {
  AdministrationEmployeeScore,
  AttendanceDeductionInput,
  DeductionRuleInput,
  MinimumRequirementInput,
  ProportionSchemeInput,
  ServiceTransactionInput,
  UnitRevenue,
  UnitStaffMember
} from '@/domain/calculation/types';
import { insertRowsChunked } from '@/lib/import-shared';

const bodySchema = z.object({ simulate: z.boolean().default(false) });

export const POST = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  const simulate = body.success ? body.data.simulate : false;

  requireRole(session, simulate ? [...OPERATOR_ROLES, ROLES.DIREKTUR, ROLES.KEUANGAN] : OPERATOR_ROLES);

  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);
  if (!simulate && !['importing', 'ready_to_calculate', 'calculated'].includes(period.status)) {
    return jsonError('Periode ini tidak dalam tahap yang dapat dikalkulasi ulang.', 409);
  }

  // ---- Load all inputs ---------------------------------------------------
  const [employees, workUnits, jobGrades, proportionSchemesRaw, deductionRulesRaw, minimumRequirementsRaw] = await Promise.all([
    db.select().from(schema.employees),
    db.select().from(schema.workUnits),
    db.select().from(schema.jobGrades),
    db.select().from(schema.proportionSchemes),
    db.select().from(schema.deductionRules).where(eq(schema.deductionRules.isActive, true)),
    db.select().from(schema.minimumRequirements).where(eq(schema.minimumRequirements.isActive, true))
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const jobGradeById = new Map(jobGrades.map((g) => [g.id, g]));

  const serviceTransactions = await db.select().from(schema.serviceTransactions).where(eq(schema.serviceTransactions.periodId, resolvedParams.id));
  const bpjsClaims = await db.select().from(schema.bpjsClaims).where(eq(schema.bpjsClaims.periodId, resolvedParams.id));
  const attendanceRecords = await db.select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.periodId, resolvedParams.id));
  const performanceScores = await db.select().from(schema.performanceScores).where(eq(schema.performanceScores.periodId, resolvedParams.id));

  const claimByNumber = new Map(bpjsClaims.map((c) => [c.claimNumber, c]));

  // ---- Resolve JKN transaction values against the period's BPJS pending policy ----
  const estimateFlagByEmployee = new Map<string, boolean>();
  const resolvedTransactions = serviceTransactions
    .filter((t) => t.employeeId !== null)
    .map((t) => {
      let value = t.tariffValue;
      let isEstimate = false;
      if (t.paymentType === 'jkn' && t.bpjsClaimNumber) {
        const claim = claimByNumber.get(t.bpjsClaimNumber);
        const resolved = resolveJknTransactionValue({
          tariffValue: t.tariffValue,
          claimStatus: (claim?.status as BpjsClaimStatus) ?? null,
          realizationValue: claim?.realizationValue ?? null,
          policy: period.bpjsPendingPolicy as 'accrual' | 'cash' | 'hybrid',
          hybridDiscountBps: period.hybridDiscountBps
        });
        value = resolved.value;
        isEstimate = resolved.isEstimate;
      }
      if (isEstimate && t.employeeId) estimateFlagByEmployee.set(t.employeeId, true);
      return { ...t, resolvedValue: value };
    });

  // ---- Unit revenue (all resolved transactions per unit) -----------------
  const unitRevenueMap = new Map<string, number>();
  for (const t of resolvedTransactions) {
    if (!t.workUnitId) continue;
    unitRevenueMap.set(t.workUnitId, (unitRevenueMap.get(t.workUnitId) ?? 0) + t.resolvedValue);
  }
  const unitRevenues: UnitRevenue[] = Array.from(unitRevenueMap.entries()).map(([workUnitId, totalRevenue]) => ({
    workUnitId,
    totalRevenue
  }));

  // ---- Medis transactions (employee.category === 'medis') ----------------
  const medisTransactions: ServiceTransactionInput[] = resolvedTransactions
    .filter((t) => t.employeeId && employeeById.get(t.employeeId)?.category === 'medis' && t.workUnitId)
    .map((t) => ({
      id: t.id,
      employeeId: t.employeeId as string,
      workUnitId: t.workUnitId as string,
      paymentType: t.paymentType as 'jkn' | 'non_jkn',
      tariffValue: t.resolvedValue,
      role: t.role as ServiceTransactionInput['role'],
      serviceType: t.serviceType
    }));

  const medisSchemes: ProportionSchemeInput[] = proportionSchemesRaw
    .filter((s) => s.effectiveFrom <= period.endDate && (s.effectiveTo === null || s.effectiveTo > period.startDate))
    .map((s) => ({ workUnitId: s.workUnitId, paymentType: s.paymentType as 'jkn' | 'non_jkn', role: s.role, proportionBps: s.proportionBps }));

  // ---- Tenaga kesehatan tim unit ------------------------------------------
  const unitStaff: UnitStaffMember[] = employees
    .filter((e) => e.isActive && e.workUnitId && (e.category === 'keperawatan' || e.category === 'nakes_non_keperawatan'))
    .map((e) => ({
      employeeId: e.id,
      workUnitId: e.workUnitId as string,
      category: e.category as UnitStaffMember['category'],
      jobGradeWeightBps: e.jobGradeId ? jobGradeById.get(e.jobGradeId)?.weightFactor ?? 10_000 : 10_000,
      attendanceFactorBps: 10_000
    }));

  // ---- Administrasi/struktural indexing -----------------------------------
  const latestScoreByEmployee = new Map<string, (typeof performanceScores)[number]>();
  for (const s of performanceScores) {
    if (!s.employeeId) continue;
    const existing = latestScoreByEmployee.get(s.employeeId);
    if (!existing || (s.assessedAt ?? '') > (existing.assessedAt ?? '')) latestScoreByEmployee.set(s.employeeId, s);
  }
  const administrationScores: AdministrationEmployeeScore[] = employees
    .filter((e) => e.isActive && (e.category === 'administrasi' || e.category === 'struktural'))
    .map((e) => ({
      employeeId: e.id,
      finalScoreCentiPoints: latestScoreByEmployee.get(e.id)?.finalScore ?? 0
    }));

  // ---- Deductions ----------------------------------------------------------
  const attendanceByEmployee = new Map<string, AttendanceDeductionInput[]>();
  for (const a of attendanceRecords) {
    if (!a.employeeId) continue;
    const list = attendanceByEmployee.get(a.employeeId) ?? [];
    list.push({ employeeId: a.employeeId, recordType: a.recordType, daysCount: a.daysCount });
    attendanceByEmployee.set(a.employeeId, list);
  }
  const deductionRules: DeductionRuleInput[] = deductionRulesRaw
    .filter((r) => r.effectiveFrom <= period.endDate && (r.effectiveTo === null || r.effectiveTo > period.startDate))
    .map((r) => ({ attendanceRecordType: r.attendanceRecordType, deductionBps: r.deductionBps }));

  // ---- Minimum requirement ---------------------------------------------------
  const minimumCategoryByEmployee = new Map<string, string | null>(employees.map((e) => [e.id, e.minimumCategory]));
  const minimumRequirements: MinimumRequirementInput[] = minimumRequirementsRaw
    .filter((m) => m.effectiveFrom <= period.endDate && (m.effectiveTo === null || m.effectiveTo > period.startDate))
    .map((m) => ({ category: m.category, minimumAmount: m.minimumAmount }));

  // ---- Run the pure calculation engine --------------------------------------
  const output = runCalculationEngine({
    medisTransactions,
    medisSchemes,
    unitRevenues,
    unitStaff,
    teamUnitConfig: { proportionBps: period.teamUnitProportionBps, fixedPortionBps: period.teamUnitFixedPortionBps },
    administrationAllocation: period.administrationAllocation ?? 0,
    administrationScores,
    attendanceByEmployee,
    deductionRules,
    minimumCategoryByEmployee,
    minimumRequirements,
    budgetCap: period.jaspelBudgetCap,
    estimateFlagByEmployee
  });

  // ---- Persist the run + results ---------------------------------------------
  const previousRuns = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, resolvedParams.id));
  const runId = newId('run');
  await db.insert(schema.calculationRuns).values({
    id: runId,
    periodId: resolvedParams.id,
    runNumber: previousRuns.length + 1,
    isSimulation: simulate,
    parameterSnapshotJson: JSON.stringify({
      teamUnitProportionBps: period.teamUnitProportionBps,
      teamUnitFixedPortionBps: period.teamUnitFixedPortionBps,
      bpjsPendingPolicy: period.bpjsPendingPolicy,
      hybridDiscountBps: period.hybridDiscountBps,
      administrationAllocation: period.administrationAllocation,
      jaspelBudgetCap: period.jaspelBudgetCap,
      proportionSchemes: medisSchemes,
      deductionRules,
      minimumRequirements
    }),
    inputSummaryJson: JSON.stringify({
      serviceTransactionCount: serviceTransactions.length,
      unitCount: unitRevenues.length,
      unitStaffCount: unitStaff.length,
      administrationEmployeeCount: administrationScores.length
    }),
    status: 'completed',
    totalGrossAmount: output.totalGrossAmount,
    totalNetAmount: output.totalNetAmount,
    adjustmentFactorBps: output.adjustmentFactorBps,
    startedBy: session.sub,
    finishedAt: Math.floor(Date.now() / 1000)
  });

  await insertRowsChunked(
    db,
    (r: (typeof output.results)[number]) =>
      db.insert(schema.calculationResults).values({
        id: newId('res'),
        runId,
        periodId: resolvedParams.id,
        employeeId: r.employeeId,
        category: r.category,
        grossAmount: r.grossAmount,
        deductionAmount: r.deductionAmount,
        minimumTopupAmount: r.minimumTopupAmount,
        paguAdjustmentAmount: r.paguAdjustmentAmount,
        netAmount: r.netAmount,
        componentBreakdownJson: JSON.stringify(r.breakdown),
        isEstimate: r.isEstimate
      }),
    output.results
  );

  if (!simulate && period.status !== 'calculated') {
    await db.update(schema.calculationPeriods).set({ status: 'calculated', updatedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.calculationPeriods.id, resolvedParams.id));
  }

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: simulate ? 'simulate' : 'calculate',
    entityType: 'calculation_run',
    entityId: runId,
    after: { totalGrossAmount: output.totalGrossAmount, totalNetAmount: output.totalNetAmount, budgetCapApplied: output.budgetCapApplied }
  });

  return jsonOk({
    runId,
    isSimulation: simulate,
    totalGrossAmount: output.totalGrossAmount,
    totalNetAmount: output.totalNetAmount,
    adjustmentFactorBps: output.adjustmentFactorBps,
    budgetCapApplied: output.budgetCapApplied,
    employeeCount: output.results.length
  });
});
