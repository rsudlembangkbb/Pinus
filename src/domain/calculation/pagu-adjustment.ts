export interface PaguAdjustmentInput {
  employeeId: string;
  amount: number;
}

export interface PaguAdjustmentEntry {
  employeeId: string;
  originalAmount: number;
  adjustedAmount: number;
  adjustmentAmount: number; // negative when scaled down
}

export interface PaguAdjustmentOutput {
  applied: boolean;
  factorBps: number; // 10000 = no adjustment (nominal rate, for display only)
  totalBefore: number;
  totalAfter: number;
  entries: PaguAdjustmentEntry[];
}

/**
 * Penyesuaian Proporsional atas Pagu (PRD 5.3.6 / 9.4): if the sum of all
 * proportional-method results exceeds the period's Jaspel budget
 * allocation, every recipient is scaled down by the same factor so the
 * total exactly matches the cap.
 *
 * Each employee's exact share is computed as `amount * cap / totalBefore`
 * using BigInt arithmetic (not a pre-rounded basis-point rate) so the
 * result is exact regardless of how large the Rupiah totals get - a
 * naive `amount * roundedFactorBps / 10000` two-step rounding drifts by
 * many Rupiah on large hospital-wide totals. The residual fractional
 * Rupiah left after flooring every share is then handed out one unit at
 * a time to the largest remainders (largest-remainder method), which
 * guarantees the adjusted total is exactly the cap and never drifts.
 */
export function applyBudgetCap(inputs: PaguAdjustmentInput[], budgetCap: number | null): PaguAdjustmentOutput {
  const totalBefore = inputs.reduce((acc, i) => acc + i.amount, 0);

  if (budgetCap === null || totalBefore <= budgetCap || totalBefore === 0) {
    return {
      applied: false,
      factorBps: 10_000,
      totalBefore,
      totalAfter: totalBefore,
      entries: inputs.map((i) => ({
        employeeId: i.employeeId,
        originalAmount: i.amount,
        adjustedAmount: i.amount,
        adjustmentAmount: 0
      }))
    };
  }

  const cap = BigInt(Math.trunc(budgetCap));
  const total = BigInt(Math.trunc(totalBefore));

  const raw = inputs.map((i) => {
    const amount = BigInt(Math.trunc(i.amount));
    const numerator = amount * cap;
    const floor = numerator / total; // BigInt division truncates toward zero (safe here, both operands >= 0)
    const remainder = numerator - floor * total; // in [0, total)
    return { employeeId: i.employeeId, original: i.amount, floor, remainder };
  });

  const distributed = raw.reduce((acc, r) => acc + r.floor, 0n);
  let remaining = cap - distributed; // guaranteed 0 <= remaining < inputs.length

  const byRemainderDesc = [...raw].sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0));
  for (let i = 0; i < byRemainderDesc.length && remaining > 0n; i++, remaining--) {
    byRemainderDesc[i]!.floor += 1n;
  }

  const finalByEmployee = new Map(raw.map((r) => [r.employeeId, Number(r.floor)]));
  const totalAfter = raw.reduce((acc, r) => acc + (finalByEmployee.get(r.employeeId) ?? 0), 0);
  const factorBps = Math.floor((budgetCap * 10_000) / totalBefore);

  return {
    applied: true,
    factorBps,
    totalBefore,
    totalAfter,
    entries: raw.map((r) => {
      const adjustedAmount = finalByEmployee.get(r.employeeId) ?? 0;
      return {
        employeeId: r.employeeId,
        originalAmount: r.original,
        adjustedAmount,
        adjustmentAmount: adjustedAmount - r.original
      };
    })
  };
}
