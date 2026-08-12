import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export function money(value: Decimal.Value): Money {
  return new Decimal(value);
}

export const ZERO = money(0);

/** Rupiah has no subunit in practice — round every stored/reported amount to the nearest whole rupiah. */
export function roundRupiah(value: Decimal.Value): Money {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function percentOf(base: Decimal.Value, percentage: Decimal.Value): Money {
  return new Decimal(base).mul(percentage).div(100);
}

export function sum(values: Decimal.Value[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(v), ZERO);
}
