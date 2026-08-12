import Decimal from "decimal.js";
import { calculateMedicalStaff } from "./medical-staff-engine";
import { calculateUnitTeam } from "./unit-team-engine";
import { calculateAdminIndexing } from "./admin-indexing-engine";
import { applyDeduction } from "./deductions";
import { applyMinimumRequirement } from "./minimum-requirement";
import { applyPaguAdjustment } from "./pagu-adjustment";
import { roundRupiah, ZERO } from "./money";
import {
  AttendanceInput,
  DeductionRuleInput,
  EmployeeInput,
  IndexingScoreInput,
  IndexingWeightInput,
  MinimumRequirementInput,
  PerformanceInput,
  ProportionResolver,
  ServiceTransactionInput,
  UnitTeamSubsidyConfig,
} from "./types";

export const FORMULA_VERSION = "pinus-jaspel-v1";

export interface CalculatePeriodInput {
  employees: EmployeeInput[];
  transactions: ServiceTransactionInput[];
  attendance: AttendanceInput[];
  performance: PerformanceInput[];
  indexingScores: IndexingScoreInput[];
  indexingWeights: IndexingWeightInput[];
  deductionRules: DeductionRuleInput[];
  minimumRequirements: MinimumRequirementInput[];
  resolveProportion: ProportionResolver;
  adminBudget: Decimal.Value;
  performanceBudgetCap?: Decimal.Value | null;
  unitTeamSubsidyConfig?: UnitTeamSubsidyConfig;
}

export interface EmployeeFinalResult {
  employeeId: string;
  staffCategory: string;
  grossAmount: string;
  deductionAmount: string;
  deductionTrigger: string | null;
  minimumRequirementApplied: boolean;
  paguAdjustmentFactor: string;
  netAmount: string;
  components: Record<string, unknown>;
  formulaVersion: string;
}

export interface CalculatePeriodResult {
  employees: EmployeeFinalResult[];
  totalGross: string;
  totalBeforeAdjustment: string;
  totalFinal: string;
  paguAdjustmentFactor: string;
}

/**
 * Pure orchestrator — no DB/HTTP access. The Nest CalculationService fetches
 * all rows, maps them to these input shapes, calls this function, then
 * persists CalculationResult rows from the output. Every step (medical
 * staff, unit team, admin indexing, deductions, minimum requirement, pagu
 * adjustment) is independently unit-testable via its own module.
 */
export function calculatePeriod(input: CalculatePeriodInput): CalculatePeriodResult {
  const attendanceByEmployee = new Map(input.attendance.map((a) => [a.employeeId, a]));

  const medicalResults = calculateMedicalStaff(input.transactions, input.resolveProportion);
  const unitTeamResults = calculateUnitTeam(
    input.transactions,
    input.employees,
    input.resolveProportion,
    input.unitTeamSubsidyConfig,
  );
  const adminResults = calculateAdminIndexing(
    input.adminBudget,
    input.employees,
    input.indexingScores,
    input.indexingWeights,
    input.attendance,
    input.performance,
  );

  const employeeById = new Map(input.employees.map((e) => [e.id, e]));

  const grossByEmployee = new Map<
    string,
    { grossAmount: Decimal; formula: string; grossDetail: unknown }
  >();

  for (const r of medicalResults) {
    grossByEmployee.set(r.employeeId, {
      grossAmount: r.grossAmount,
      formula: "medical_staff_proportional",
      grossDetail: r.lineItems,
    });
  }
  for (const r of unitTeamResults) {
    grossByEmployee.set(r.employeeId, {
      grossAmount: r.grossAmount,
      formula: "unit_team_distribution",
      grossDetail: r.lineItems,
    });
  }
  for (const r of adminResults) {
    grossByEmployee.set(r.employeeId, {
      grossAmount: r.grossAmount,
      formula: "admin_structural_indexing",
      grossDetail: {
        lineItems: r.lineItems,
        individualScore: r.individualScore.toString(),
        totalScoreAllEmployees: r.totalScoreAllEmployees.toString(),
      },
    });
  }

  interface Interim {
    employeeId: string;
    staffCategory: string;
    grossAmount: Decimal;
    formula: string;
    grossDetail: unknown;
    deductionAmount: Decimal;
    deductionTrigger: string | null;
    deductionPercentage: Decimal;
    minimumRequirementApplied: boolean;
    minimumLevel: string | null;
    minimumAmount: Decimal | null;
    netAmountBeforeAdjustment: Decimal;
  }

  const interim: Interim[] = [];
  for (const [employeeId, entry] of grossByEmployee) {
    const employee = employeeById.get(employeeId);
    if (!employee) continue;

    const attendance = attendanceByEmployee.get(employeeId);
    const deduction = applyDeduction(entry.grossAmount, attendance, input.deductionRules);
    const afterDeduction = entry.grossAmount.minus(deduction.amount);

    const minReq = applyMinimumRequirement(
      afterDeduction,
      employee.minimumRequirementLevel,
      input.minimumRequirements,
    );

    const minimumRule = employee.minimumRequirementLevel
      ? input.minimumRequirements.find((r) => r.level === employee.minimumRequirementLevel)
      : undefined;

    interim.push({
      employeeId,
      staffCategory: employee.staffCategory,
      grossAmount: entry.grossAmount,
      formula: entry.formula,
      grossDetail: entry.grossDetail,
      deductionAmount: deduction.amount,
      deductionTrigger: deduction.trigger,
      deductionPercentage: deduction.percentage,
      minimumRequirementApplied: minReq.applied,
      minimumLevel: employee.minimumRequirementLevel,
      minimumAmount: minimumRule ? new Decimal(minimumRule.minimumAmount) : null,
      netAmountBeforeAdjustment: minReq.netAmount,
    });
  }

  const paguResult = applyPaguAdjustment(
    interim.map((i) => ({ employeeId: i.employeeId, netAmount: i.netAmountBeforeAdjustment })),
    input.performanceBudgetCap ?? null,
  );
  const netByEmployee = new Map(paguResult.results.map((r) => [r.employeeId, r]));

  const employees: EmployeeFinalResult[] = interim.map((i) => {
    const adjusted = netByEmployee.get(i.employeeId)!;
    return {
      employeeId: i.employeeId,
      staffCategory: i.staffCategory,
      grossAmount: roundRupiah(i.grossAmount).toString(),
      deductionAmount: roundRupiah(i.deductionAmount).toString(),
      deductionTrigger: i.deductionTrigger,
      minimumRequirementApplied: i.minimumRequirementApplied,
      paguAdjustmentFactor: adjusted.adjustmentFactor.toString(),
      netAmount: adjusted.netAmount.toString(),
      formulaVersion: FORMULA_VERSION,
      components: {
        formula: i.formula,
        grossAmount: roundRupiah(i.grossAmount).toString(),
        grossDetail: i.grossDetail,
        deduction: {
          trigger: i.deductionTrigger,
          percentage: i.deductionPercentage.toString(),
          amount: roundRupiah(i.deductionAmount).toString(),
        },
        minimumRequirement: {
          applied: i.minimumRequirementApplied,
          level: i.minimumLevel,
          minimumAmount: i.minimumAmount?.toString() ?? null,
        },
        netAmountBeforeAdjustment: roundRupiah(i.netAmountBeforeAdjustment).toString(),
        paguAdjustmentFactor: adjusted.adjustmentFactor.toString(),
      },
    };
  });

  const totalGross = employees.reduce((acc, e) => acc.plus(e.grossAmount), ZERO);
  const totalFinal = employees.reduce((acc, e) => acc.plus(e.netAmount), ZERO);

  return {
    employees,
    totalGross: totalGross.toString(),
    totalBeforeAdjustment: roundRupiah(paguResult.totalBeforeAdjustment).toString(),
    totalFinal: totalFinal.toString(),
    paguAdjustmentFactor: paguResult.adjustmentFactor.toString(),
  };
}
