import { describe, expect, it } from 'vitest';
import { applyMinimumRequirement } from '@/domain/calculation/minimum-requirement';

const minimums = [
  { category: 'dokter_spesialis', minimumAmount: 15_000_000 },
  { category: 'perawat_mahir', minimumAmount: 3_000_000 }
];

describe('applyMinimumRequirement', () => {
  it('tops up when below the minimum', () => {
    const result = applyMinimumRequirement(10_000_000, 'dokter_spesialis', minimums);
    expect(result.topupAmount).toBe(5_000_000);
    expect(result.line).not.toBeNull();
  });

  it('does not top up when already at or above the minimum', () => {
    const result = applyMinimumRequirement(20_000_000, 'dokter_spesialis', minimums);
    expect(result.topupAmount).toBe(0);
    expect(result.line).toBeNull();
  });

  it('is a no-op for employees with no protected category', () => {
    const result = applyMinimumRequirement(1_000, null, minimums);
    expect(result.topupAmount).toBe(0);
  });

  it('is a no-op for a category with no configured minimum', () => {
    const result = applyMinimumRequirement(1_000, 'tenaga_administrasi', minimums);
    expect(result.topupAmount).toBe(0);
  });
});
