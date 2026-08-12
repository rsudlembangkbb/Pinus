import Decimal from "decimal.js";
import { money, roundRupiah, sum, ZERO } from "./money";

export interface PaguAdjustmentInput {
  employeeId: string;
  netAmount: Decimal.Value;
}

export interface PaguAdjustmentOutput {
  employeeId: string;
  netAmount: Decimal;
  adjustmentFactor: Decimal;
}

export interface PaguAdjustmentSummary {
  totalBeforeAdjustment: Decimal;
  adjustmentFactor: Decimal;
  results: PaguAdjustmentOutput[];
}

/**
 * PRD §9.4/§4 step 9 — if the sum of all Metode Proporsionalitas results
 * exceeds the period's available performance budget (pagu), every
 * recipient is cut by the same factor (cap / total). The regulation text
 * applies this "to all recipients" uniformly; it does not carve out an
 * exception for employees already lifted to their minimum-requirement
 * floor, so this single pass does not re-check the floor after cutting —
 * that tension in the source regulation is a known open question (see
 * PRD §9.4) to confirm with RSUD Lembang management before go-live.
 */
export function applyPaguAdjustment(
  results: PaguAdjustmentInput[],
  budgetCap: Decimal.Value | null | undefined,
): PaguAdjustmentSummary {
  const totalBeforeAdjustment = sum(results.map((r) => r.netAmount.toString()));

  if (budgetCap === null || budgetCap === undefined || totalBeforeAdjustment.lte(0)) {
    return {
      totalBeforeAdjustment,
      adjustmentFactor: money(1),
      results: results.map((r) => ({
        employeeId: r.employeeId,
        netAmount: roundRupiah(r.netAmount),
        adjustmentFactor: money(1),
      })),
    };
  }

  const cap = money(budgetCap);
  if (totalBeforeAdjustment.lte(cap)) {
    return {
      totalBeforeAdjustment,
      adjustmentFactor: money(1),
      results: results.map((r) => ({
        employeeId: r.employeeId,
        netAmount: roundRupiah(r.netAmount),
        adjustmentFactor: money(1),
      })),
    };
  }

  const factor = cap.div(totalBeforeAdjustment);
  return {
    totalBeforeAdjustment,
    adjustmentFactor: factor,
    results: results.map((r) => ({
      employeeId: r.employeeId,
      netAmount: roundRupiah(money(r.netAmount).mul(factor)),
      adjustmentFactor: factor,
    })),
  };
}

export { ZERO };
