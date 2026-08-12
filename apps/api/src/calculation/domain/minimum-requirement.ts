import Decimal from "decimal.js";
import { money } from "./money";
import { MinimumRequirementInput } from "./types";

export interface MinimumRequirementOutcome {
  netAmount: Decimal;
  applied: boolean;
}

/**
 * PRD §9.4 — dokter sub-spesialis/spesialis/umum and perawat mahir have a
 * guaranteed floor. Applied per-employee after deductions, before the
 * pagu-wide proportional adjustment (a shortfall vs. budget is absorbed by
 * everyone else, not by employees already at their guaranteed minimum).
 */
export function applyMinimumRequirement(
  netAmount: Decimal.Value,
  level: string | null,
  requirements: MinimumRequirementInput[],
): MinimumRequirementOutcome {
  if (!level) return { netAmount: money(netAmount), applied: false };
  const requirement = requirements.find((r) => r.level === level);
  if (!requirement) return { netAmount: money(netAmount), applied: false };

  const minimum = money(requirement.minimumAmount);
  const net = money(netAmount);
  if (net.lt(minimum)) return { netAmount: minimum, applied: true };
  return { netAmount: net, applied: false };
}
