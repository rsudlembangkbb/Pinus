import { CalculationLine, MinimumRequirementInput } from './types';

export interface MinimumRequirementResult {
  topupAmount: number;
  line: CalculationLine | null;
}

/**
 * Enforces the pendapatan minimum (PRD 5.3.4 / 9.4) for eligible
 * categories (dokter sub-spesialis, spesialis, umum, perawat mahir, etc.)
 * so nobody in a protected category falls below the configured floor.
 */
export function applyMinimumRequirement(
  amountAfterDeduction: number,
  employeeMinimumCategory: string | null,
  minimums: MinimumRequirementInput[]
): MinimumRequirementResult {
  if (!employeeMinimumCategory) return { topupAmount: 0, line: null };
  const rule = minimums.find((m) => m.category === employeeMinimumCategory);
  if (!rule) return { topupAmount: 0, line: null };
  if (amountAfterDeduction >= rule.minimumAmount) return { topupAmount: 0, line: null };

  const topupAmount = rule.minimumAmount - amountAfterDeduction;
  return {
    topupAmount,
    line: {
      label: `Penyesuaian pendapatan minimum (${employeeMinimumCategory})`,
      amount: topupAmount,
      meta: { minimumAmount: rule.minimumAmount }
    }
  };
}
