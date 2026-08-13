import { percentOfBp } from "@pinus/shared";
import type { DeductionRuleCode } from "@pinus/shared";
import type { EngineDeductionRule, EngineEmployeeDeduction } from "./types.js";

export interface DeductionResult {
  percentBp: number;
  amount: number;
  ruleCodes: DeductionRuleCode[];
}

/**
 * An employee can in principle be flagged under more than one deduction
 * condition in the same period (e.g. disciplinary action recorded in the
 * same month as partial leave). Rather than stacking percentages past 100%,
 * the conservative and auditable choice is the single harshest applicable
 * rule -- summing would double-penalize on data-entry overlap that the
 * import stage does not guarantee is mutually exclusive.
 */
export function computeDeduction(
  employeeId: string,
  grossAmount: number,
  rules: EngineDeductionRule[],
  employeeDeductions: EngineEmployeeDeduction[],
): DeductionResult {
  const applicable = employeeDeductions.filter((d) => d.employeeId === employeeId);
  if (applicable.length === 0) return { percentBp: 0, amount: 0, ruleCodes: [] };

  let maxBp = 0;
  const ruleCodes: DeductionRuleCode[] = [];
  for (const d of applicable) {
    const rule = rules.find((r) => r.code === d.ruleCode);
    const bp = d.overridePercentBp ?? rule?.percentBp;
    if (bp == null) continue;
    ruleCodes.push(d.ruleCode);
    if (bp > maxBp) maxBp = bp;
  }

  return {
    percentBp: maxBp,
    amount: percentOfBp(grossAmount, maxBp),
    ruleCodes,
  };
}
