import { calculateMedisIncentives } from './medis';
import { calculateTeamUnitIncentives } from './kesehatan';
import { calculateAdministrationIncentives } from './administrasi';
import { applyDeductions } from './deductions';
import { applyMinimumRequirement } from './minimum-requirement';
import { applyBudgetCap } from './pagu-adjustment';
import {
  AdministrationEmployeeScore,
  AttendanceDeductionInput,
  CalculationLine,
  DeductionRuleInput,
  EmployeeCalculationResult,
  MinimumRequirementInput,
  ProportionSchemeInput,
  ServiceTransactionInput,
  TeamUnitConfig,
  UnitRevenue,
  UnitStaffMember
} from './types';

export interface EngineInput {
  medisTransactions: ServiceTransactionInput[];
  medisSchemes: ProportionSchemeInput[];

  unitRevenues: UnitRevenue[];
  unitStaff: UnitStaffMember[];
  teamUnitConfig: TeamUnitConfig;

  administrationAllocation: number;
  administrationScores: AdministrationEmployeeScore[];

  attendanceByEmployee: Map<string, AttendanceDeductionInput[]>;
  deductionRules: DeductionRuleInput[];

  minimumCategoryByEmployee: Map<string, string | null>;
  minimumRequirements: MinimumRequirementInput[];

  budgetCap: number | null;

  /** true if any contributing service transaction relied on a non-final BPJS claim estimate. */
  estimateFlagByEmployee: Map<string, boolean>;
}

export interface EngineOutput {
  results: EmployeeCalculationResult[];
  totalGrossAmount: number;
  totalNetAmount: number;
  adjustmentFactorBps: number;
  budgetCapApplied: boolean;
}

/**
 * Orchestrates the full monthly Jaspel calculation: gross incentive per
 * category -> deductions -> minimum requirement top-up -> proportional
 * budget-cap adjustment. Pure function over plain data - no I/O.
 */
export function runCalculationEngine(input: EngineInput): EngineOutput {
  const medisResults = calculateMedisIncentives(input.medisTransactions, input.medisSchemes);
  const kesehatanResults = calculateTeamUnitIncentives(input.unitRevenues, input.unitStaff, input.teamUnitConfig);
  const administrasiResults = calculateAdministrationIncentives(
    input.administrationAllocation,
    input.administrationScores
  );

  const grossByEmployee = new Map<string, (typeof medisResults)[number]>();
  for (const r of [...medisResults, ...kesehatanResults, ...administrasiResults]) {
    grossByEmployee.set(r.employeeId, r);
  }

  const preAdjustment: {
    employeeId: string;
    category: (typeof medisResults)[number]['category'];
    grossAmount: number;
    deductionAmount: number;
    minimumTopupAmount: number;
    netAmount: number;
    breakdown: CalculationLine[];
    isEstimate: boolean;
  }[] = [];

  for (const [employeeId, gross] of grossByEmployee) {
    const attendance = input.attendanceByEmployee.get(employeeId) ?? [];
    const deduction = applyDeductions(gross.grossAmount, attendance, input.deductionRules);
    const afterDeduction = gross.grossAmount - deduction.deductionAmount;

    const minimumCategory = input.minimumCategoryByEmployee.get(employeeId) ?? null;
    const minimum = applyMinimumRequirement(afterDeduction, minimumCategory, input.minimumRequirements);

    const netBeforeCap = afterDeduction + minimum.topupAmount;

    const breakdown = [...gross.breakdown, ...deduction.lines, ...(minimum.line ? [minimum.line] : [])];

    preAdjustment.push({
      employeeId,
      category: gross.category,
      grossAmount: gross.grossAmount,
      deductionAmount: deduction.deductionAmount,
      minimumTopupAmount: minimum.topupAmount,
      netAmount: netBeforeCap,
      breakdown,
      isEstimate: input.estimateFlagByEmployee.get(employeeId) ?? false
    });
  }

  const cap = applyBudgetCap(
    preAdjustment.map((p) => ({ employeeId: p.employeeId, amount: p.netAmount })),
    input.budgetCap
  );
  const adjustmentByEmployee = new Map(cap.entries.map((e) => [e.employeeId, e]));

  const results: EmployeeCalculationResult[] = preAdjustment.map((p) => {
    const adj = adjustmentByEmployee.get(p.employeeId);
    const paguAdjustmentAmount = adj?.adjustmentAmount ?? 0;
    const breakdown = [...p.breakdown];
    if (paguAdjustmentAmount !== 0) {
      breakdown.push({
        label: 'Penyesuaian proporsional atas pagu',
        amount: paguAdjustmentAmount,
        meta: { factorBps: cap.factorBps }
      });
    }
    return {
      employeeId: p.employeeId,
      category: p.category,
      grossAmount: p.grossAmount,
      deductionAmount: p.deductionAmount,
      minimumTopupAmount: p.minimumTopupAmount,
      paguAdjustmentAmount,
      netAmount: adj?.adjustedAmount ?? p.netAmount,
      breakdown,
      isEstimate: p.isEstimate
    };
  });

  return {
    results,
    totalGrossAmount: preAdjustment.reduce((acc, p) => acc + p.grossAmount, 0),
    totalNetAmount: results.reduce((acc, r) => acc + r.netAmount, 0),
    adjustmentFactorBps: cap.factorBps,
    budgetCapApplied: cap.applied
  };
}
