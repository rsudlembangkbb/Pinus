import type { EngineEmployee, EngineMinimumRequirement } from "./types.js";

export interface MinimumRequirementResult {
  applied: boolean;
  minAmount: number | null;
  flooredAmount: number;
}

/**
 * PRD 9.4: dokter sub-spesialis, spesialis, umum, dan perawat mahir punya
 * jaminan pendapatan minimum. Matching dilakukan via `professionKey`
 * (case-insensitive) terhadap field profession pegawai -- daftar profesi
 * yang dijamin sepenuhnya konfigurasi (master data), bukan hard-coded.
 */
export function applyMinimumRequirement(
  employee: EngineEmployee,
  amountAfterDeduction: number,
  minimumRequirements: EngineMinimumRequirement[],
): MinimumRequirementResult {
  if (!employee.profession) return { applied: false, minAmount: null, flooredAmount: amountAfterDeduction };

  const match = minimumRequirements.find(
    (m) => m.professionKey.toLowerCase() === employee.profession!.toLowerCase(),
  );
  if (!match) return { applied: false, minAmount: null, flooredAmount: amountAfterDeduction };

  if (amountAfterDeduction >= match.minAmount) {
    return { applied: false, minAmount: match.minAmount, flooredAmount: amountAfterDeduction };
  }
  return { applied: true, minAmount: match.minAmount, flooredAmount: match.minAmount };
}
