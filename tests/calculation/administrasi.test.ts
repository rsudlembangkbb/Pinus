import { describe, expect, it } from 'vitest';
import { calculateAdministrationIncentives } from '@/domain/calculation/administrasi';

describe('calculateAdministrationIncentives', () => {
  it('distributes allocation proportional to score and sums exactly to the allocation', () => {
    const scores = [
      { employeeId: 'a', finalScoreCentiPoints: 9000 },
      { employeeId: 'b', finalScoreCentiPoints: 8000 },
      { employeeId: 'c', finalScoreCentiPoints: 7000 }
    ];
    const allocation = 10_000_000;
    const result = calculateAdministrationIncentives(allocation, scores);
    const total = result.reduce((acc, r) => acc + r.grossAmount, 0);
    expect(total).toBe(allocation); // largest-remainder method guarantees exact sum
    // higher score -> higher (or equal) share
    const byId = Object.fromEntries(result.map((r) => [r.employeeId, r.grossAmount]));
    expect(byId.a).toBeGreaterThan(byId.b);
    expect(byId.b).toBeGreaterThan(byId.c);
  });

  it('returns zero for everyone when total score is zero', () => {
    const result = calculateAdministrationIncentives(1_000_000, [{ employeeId: 'a', finalScoreCentiPoints: 0 }]);
    expect(result[0]!.grossAmount).toBe(0);
  });

  it('handles many employees with tiny remainders without losing/gaining rupiah', () => {
    const scores = Array.from({ length: 137 }, (_, i) => ({
      employeeId: `emp-${i}`,
      finalScoreCentiPoints: 1000 + i
    }));
    const allocation = 987_654_321;
    const result = calculateAdministrationIncentives(allocation, scores);
    const total = result.reduce((acc, r) => acc + r.grossAmount, 0);
    expect(total).toBe(allocation);
  });
});
