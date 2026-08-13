import { percentOfBp, type CalculationComponent } from "@pinus/shared";
import { findProportionBp } from "./proportion.js";
import type { EngineEmployee, EngineProportionRule, EngineTransaction } from "./types.js";

export interface MedisCalculationRow {
  employeeId: string;
  grossAmount: number;
  components: CalculationComponent[];
}

/**
 * Tenaga medis (PRD 9.1): insentif = proporsi tertentu dari nilai
 * klaim/tarif per transaksi, dijumlahkan per pegawai. Tidak dibatasi target
 * kinerja -- setiap transaksi yang tercatat dihitung penuh.
 */
export function calculateMedis(
  employees: EngineEmployee[],
  transactions: EngineTransaction[],
  proportionRules: EngineProportionRule[],
): MedisCalculationRow[] {
  const medisIds = new Set(employees.filter((e) => e.category === "MEDIS" && e.isActive).map((e) => e.id));
  const byEmployee = new Map<string, MedisCalculationRow>();

  for (const tx of transactions) {
    if (!medisIds.has(tx.employeeId)) continue;
    const bp = findProportionBp(proportionRules, tx);
    if (bp === null) continue; // unmapped rule: surfaced as a validation warning upstream, not silently zeroed at commit time

    const amount = percentOfBp(tx.tariffValue, bp);
    const row = byEmployee.get(tx.employeeId) ?? { employeeId: tx.employeeId, grossAmount: 0, components: [] };
    row.grossAmount += amount;
    row.components.push({
      label: `${tx.serviceCategory} · ${tx.penjaminanStatus} · ${tx.serviceRole}`,
      basisAmount: tx.tariffValue,
      percentBp: bp,
      amount,
    });
    byEmployee.set(tx.employeeId, row);
  }

  return [...byEmployee.values()];
}
