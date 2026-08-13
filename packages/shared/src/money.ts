// Fixed-point arithmetic helpers shared by the calculation engine (server)
// and any client-side previews. Money is always an integer number of
// Rupiah; percentages/weights are integer basis points (1 bp = 0.01%).
//
// Internally, multi-step proportional math is done in bigint "micro units"
// (amount scaled by 10^6) so that chaining several percentage multiplications
// never touches IEEE-754 floats -- only the final result is rounded back to
// whole Rupiah. This satisfies the PRD's "no floating point for financial
// calculations" non-functional requirement (section 6).

export const BP_SCALE = 10_000n; // 10000 bp = 100%
const MICRO_SCALE = 1_000_000n;

export type Micros = bigint;

export function toMicros(rupiah: number): Micros {
  if (!Number.isFinite(rupiah)) throw new Error(`Invalid amount: ${rupiah}`);
  return BigInt(Math.round(rupiah)) * MICRO_SCALE;
}

export function microsOfBp(microAmount: Micros, bp: number): Micros {
  // microAmount * bp / 10000, staying in bigint the whole way.
  return (microAmount * BigInt(bp)) / BP_SCALE;
}

export function addMicros(a: Micros, b: Micros): Micros {
  return a + b;
}

export function subMicros(a: Micros, b: Micros): Micros {
  return a - b;
}

/** Round-half-up to the nearest whole Rupiah. */
export function toRupiah(micros: Micros): number {
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;
  const whole = abs / MICRO_SCALE;
  const remainder = abs % MICRO_SCALE;
  const rounded = remainder * 2n >= MICRO_SCALE ? whole + 1n : whole;
  const result = negative ? -rounded : rounded;
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Rupiah amount exceeds safe integer range");
  }
  return Number(result);
}

/** amount (Rupiah) * percent (basis points) -> Rupiah, single-step convenience. */
export function percentOfBp(amountRupiah: number, bp: number): number {
  return toRupiah(microsOfBp(toMicros(amountRupiah), bp));
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function bpToPercentLabel(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

export function percentToBp(percent: number): number {
  return Math.round(percent * 100);
}
