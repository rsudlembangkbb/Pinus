import { percentOfBp } from "@pinus/shared";
import type { CalculationEngineKind, CalculationComponent } from "@pinus/shared";
import { computeDeduction } from "./deductions.js";
import { calculateIndexing } from "./indexing.js";
import { calculateMedis } from "./medis.js";
import { applyMinimumRequirement } from "./minimumRequirement.js";
import { computeAdjustmentFactorBp } from "./paguAdjustment.js";
import { calculateTimUnit } from "./timUnit.js";
import type {
  CalculationEngineInput,
  CalculationEngineOutput,
  EmployeeCalculationResult,
} from "./types.js";

interface RawRow {
  employeeId: string;
  engineKind: CalculationEngineKind;
  grossAmount: number;
  components: CalculationComponent[];
}

/**
 * Orchestrates the three proportional engines (medis / tim-unit / indeksing)
 * against a single period's data, then applies deductions, minimum
 * requirement floors, and the pagu proportional adjustment as documented
 * cross-cutting passes. Every intermediate figure is captured in
 * `components` so a result can always be reconstructed and explained (PRD
 * "Auditability" + "Log Kalkulasi").
 */
export function runCalculationEngine(input: CalculationEngineInput): CalculationEngineOutput {
  const medisRows = calculateMedis(input.employees, input.transactions, input.proportionRules);
  const timUnitRows = calculateTimUnit(
    input.employees,
    input.transactions,
    input.proportionRules,
    input.jobGrades,
    input.subsidy,
  );
  const indexingRows = calculateIndexing(
    input.employees,
    input.indexingWeights,
    input.performanceScores,
    input.administrasiAllocationAmount,
  );

  const raw: RawRow[] = [
    ...medisRows.map((r) => ({ ...r, engineKind: "MEDIS" as const })),
    ...timUnitRows.map((r) => ({ ...r, engineKind: "TIM_UNIT" as const })),
    ...indexingRows.map((r) => ({ ...r, engineKind: "INDEKSING" as const })),
  ];

  const employeeById = new Map(input.employees.map((e) => [e.id, e]));

  const preliminary = raw.map((row) => {
    const employee = employeeById.get(row.employeeId);
    const deduction = computeDeduction(row.employeeId, row.grossAmount, input.deductionRules, input.employeeDeductions);
    const afterDeduction = row.grossAmount - deduction.amount;

    const floor = employee
      ? applyMinimumRequirement(employee, afterDeduction, input.minimumRequirements)
      : { applied: false, minAmount: null, flooredAmount: afterDeduction };

    const components: CalculationComponent[] = [...row.components];
    if (deduction.amount > 0) {
      components.push({
        label: `Potongan (${deduction.ruleCodes.join(", ")})`,
        basisAmount: row.grossAmount,
        percentBp: deduction.percentBp,
        amount: -deduction.amount,
      });
    }
    if (floor.applied) {
      components.push({
        label: "Penyesuaian minimum requirement",
        basisAmount: afterDeduction,
        percentBp: null,
        amount: floor.flooredAmount - afterDeduction,
      });
    }

    return {
      employeeId: row.employeeId,
      engineKind: row.engineKind,
      grossAmount: row.grossAmount,
      deductionAmount: deduction.amount,
      deductionRuleCodes: deduction.ruleCodes,
      minimumRequirementApplied: floor.applied,
      minimumRequirementAmount: floor.minAmount,
      flooredAmount: floor.flooredAmount,
      components,
    };
  });

  const totalBeforeAdjustment = preliminary.reduce((sum, r) => sum + r.flooredAmount, 0);

  let results: EmployeeCalculationResult[];
  let adjustmentFactorBp: number;

  if (input.exemptMinimumFromAdjustment) {
    const exemptTotal = preliminary
      .filter((r) => r.minimumRequirementApplied)
      .reduce((sum, r) => sum + r.flooredAmount, 0);
    const nonExemptTotal = totalBeforeAdjustment - exemptTotal;
    const remainingPagu = input.paguAmount == null ? null : Math.max(0, input.paguAmount - exemptTotal);
    const nonExemptFactorBp = computeAdjustmentFactorBp(nonExemptTotal, remainingPagu);
    adjustmentFactorBp = nonExemptFactorBp;

    results = preliminary.map((r) => finalizeRow(r, r.minimumRequirementApplied ? 10000 : nonExemptFactorBp));
  } else {
    adjustmentFactorBp = computeAdjustmentFactorBp(totalBeforeAdjustment, input.paguAmount);
    results = preliminary.map((r) => finalizeRow(r, adjustmentFactorBp));
  }

  const totalAfterAdjustment = results.reduce((sum, r) => sum + r.netAmount, 0);

  return {
    results,
    totalBeforeAdjustment,
    totalAfterAdjustment,
    adjustmentFactorBp,
    paguExceeded: input.paguAmount != null && totalBeforeAdjustment > input.paguAmount,
  };
}

function finalizeRow(
  row: {
    employeeId: string;
    engineKind: CalculationEngineKind;
    grossAmount: number;
    deductionAmount: number;
    deductionRuleCodes: EmployeeCalculationResult["deductionRuleCodes"];
    minimumRequirementApplied: boolean;
    minimumRequirementAmount: number | null;
    flooredAmount: number;
    components: CalculationComponent[];
  },
  adjustmentFactorBp: number,
): EmployeeCalculationResult {
  const netAmount = adjustmentFactorBp === 10000 ? row.flooredAmount : percentOfBp(row.flooredAmount, adjustmentFactorBp);
  const components = [...row.components];
  if (adjustmentFactorBp !== 10000) {
    components.push({
      label: "Penyesuaian proporsional atas pagu",
      basisAmount: row.flooredAmount,
      percentBp: adjustmentFactorBp,
      amount: netAmount - row.flooredAmount,
    });
  }
  return {
    employeeId: row.employeeId,
    engineKind: row.engineKind,
    grossAmount: row.grossAmount,
    deductionAmount: row.deductionAmount,
    deductionRuleCodes: row.deductionRuleCodes,
    minimumRequirementApplied: row.minimumRequirementApplied,
    minimumRequirementAmount: row.minimumRequirementAmount,
    adjustmentFactorBp,
    netAmount,
    components,
  };
}
