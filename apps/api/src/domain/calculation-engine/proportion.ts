import type { EngineProportionRule, EngineTransaction } from "./types.js";

/**
 * Finds the applicable proportion percentage (basis points) for a
 * transaction. Rules with a specific `serviceRole` take precedence over a
 * role-agnostic rule (serviceRole: null) for the same service
 * category/penjaminan status -- this is what lets IBS carry separate
 * operator/co-operator/anestesi rows while every other unit uses a single
 * role-agnostic row.
 */
export function findProportionBp(
  rules: EngineProportionRule[],
  transaction: Pick<EngineTransaction, "serviceCategory" | "penjaminanStatus" | "serviceRole">,
): number | null {
  const specific = rules.find(
    (r) =>
      r.serviceCategory === transaction.serviceCategory &&
      r.penjaminanStatus === transaction.penjaminanStatus &&
      r.serviceRole === transaction.serviceRole,
  );
  if (specific) return specific.percentBp;

  const generic = rules.find(
    (r) =>
      r.serviceCategory === transaction.serviceCategory &&
      r.penjaminanStatus === transaction.penjaminanStatus &&
      r.serviceRole === null,
  );
  return generic ? generic.percentBp : null;
}
