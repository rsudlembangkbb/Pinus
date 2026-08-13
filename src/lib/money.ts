/**
 * Integer-only money helpers. All amounts are whole Rupiah; all
 * percentages/weights are basis points (1/100 of a percent -> 10000 = 100%).
 * Never use floating point for these calculations - see PRD section 6/11.
 */

export const BPS_DENOMINATOR = 10_000;

/** Applies a basis-point rate to a Rupiah amount, rounding half-up to the nearest Rupiah. */
export function applyBps(amount: number, bps: number): number {
  const product = amount * bps;
  const quotient = Math.floor(product / BPS_DENOMINATOR);
  const remainder = product - quotient * BPS_DENOMINATOR;
  // round half up
  return remainder * 2 >= BPS_DENOMINATOR ? quotient + 1 : quotient;
}

export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((acc, v) => acc + v, 0);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function bpsToPercentLabel(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
