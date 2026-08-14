import { describe, expect, it } from 'vitest';
import { applyBps, percentToBps } from '@/lib/money';

describe('applyBps', () => {
  it('applies a simple percentage', () => {
    expect(applyBps(1_000_000, percentToBps(12.5))).toBe(125_000);
  });

  it('rounds half up to the nearest rupiah', () => {
    // 100 * 3.335% = 3.335 -> rounds to 3 (since 0.335 truncates to .33 at bps precision anyway)
    expect(applyBps(100, percentToBps(3.5))).toBe(4); // 3.5 exact -> 3.5 rounds to 4
    expect(applyBps(3, 5000)).toBe(2); // 3 * 50% = 1.5 -> rounds up to 2
  });

  it('never returns a fractional amount', () => {
    const result = applyBps(1_234_567, 1337);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('handles zero correctly', () => {
    expect(applyBps(0, 5000)).toBe(0);
    expect(applyBps(1000, 0)).toBe(0);
  });
});
