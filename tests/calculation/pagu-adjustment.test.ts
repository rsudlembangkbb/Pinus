import { describe, expect, it } from 'vitest';
import { applyBudgetCap } from '@/domain/calculation/pagu-adjustment';

describe('applyBudgetCap', () => {
  it('does not adjust when the cap is null (no pagu configured)', () => {
    const result = applyBudgetCap([{ employeeId: 'a', amount: 100 }], null);
    expect(result.applied).toBe(false);
    expect(result.entries[0]!.adjustedAmount).toBe(100);
  });

  it('does not adjust when total is within the cap', () => {
    const result = applyBudgetCap(
      [
        { employeeId: 'a', amount: 100 },
        { employeeId: 'b', amount: 200 }
      ],
      1_000
    );
    expect(result.applied).toBe(false);
    expect(result.totalAfter).toBe(300);
  });

  it('scales everyone down proportionally when total exceeds the cap, summing exactly to the cap', () => {
    const inputs = [
      { employeeId: 'a', amount: 1_000_000 },
      { employeeId: 'b', amount: 2_000_000 },
      { employeeId: 'c', amount: 3_333_333 }
    ];
    const cap = 5_000_000;
    const result = applyBudgetCap(inputs, cap);
    expect(result.applied).toBe(true);
    const total = result.entries.reduce((acc, e) => acc + e.adjustedAmount, 0);
    expect(total).toBe(cap);
    // proportionally: larger original amounts should still receive larger adjusted amounts
    const byId = Object.fromEntries(result.entries.map((e) => [e.employeeId, e.adjustedAmount]));
    expect(byId.c).toBeGreaterThan(byId.b);
    expect(byId.b).toBeGreaterThan(byId.a);
    // nobody gets scaled up
    for (const e of result.entries) {
      expect(e.adjustedAmount).toBeLessThanOrEqual(e.originalAmount);
    }
  });

  it('handles many recipients without rounding drift', () => {
    const inputs = Array.from({ length: 421 }, (_, i) => ({ employeeId: `e${i}`, amount: 1_000_000 + i * 137 }));
    const totalBefore = inputs.reduce((acc, i) => acc + i.amount, 0);
    const cap = Math.floor(totalBefore * 0.83);
    const result = applyBudgetCap(inputs, cap);
    const total = result.entries.reduce((acc, e) => acc + e.adjustedAmount, 0);
    expect(total).toBe(cap);
  });
});
