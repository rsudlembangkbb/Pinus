import { percentOfBp, type CalculationComponent } from "@pinus/shared";
import { findProportionBp } from "./proportion.js";
import type {
  EngineEmployee,
  EngineJobGrade,
  EngineProportionRule,
  EngineTransaction,
  SubsidyConfig,
} from "./types.js";

export interface TimUnitCalculationRow {
  employeeId: string;
  grossAmount: number;
  components: CalculationComponent[];
}

const NAKES_CATEGORIES = new Set(["KEPERAWATAN", "NAKES_LAIN"]);
const TEAM_ROLES = new Set(["PERAWAT_PELAKSANA", "PELAKSANA_LAIN"]);

/**
 * Tenaga kesehatan / tim kerja unit (PRD 9.2): pendapatan unit dihitung dulu
 * dari transaksi yang ditandai peran tim (perawat pelaksana / pelaksana
 * lain), lalu didistribusikan ke tiap individu di unit tsb berbanding lurus
 * dengan bobot job grade -- tanggung jawab & beban kerja tidak punya sumber
 * data terukur terpisah di PRD, sehingga job grade adalah proxy yang
 * dipakai (dapat diperluas begitu ada data beban kerja individual).
 *
 * Opsional: pola "porsi tetap" (tetap di unit asal) vs "porsi subsidi"
 * (dikumpulkan lintas unit lalu diratakan ke seluruh nakes RS) dari
 * dokumen acuan Kemenkes -- lihat SubsidyConfig, default nonaktif sampai
 * dikonfirmasi RSUD Lembang.
 */
export function calculateTimUnit(
  employees: EngineEmployee[],
  transactions: EngineTransaction[],
  proportionRules: EngineProportionRule[],
  jobGrades: EngineJobGrade[],
  subsidy: SubsidyConfig = { enabled: false, fixedPortionBp: 10000 },
): TimUnitCalculationRow[] {
  const nakesByUnit = new Map<string, EngineEmployee[]>();
  for (const e of employees) {
    if (!e.isActive || !NAKES_CATEGORIES.has(e.category)) continue;
    const list = nakesByUnit.get(e.workUnitId) ?? [];
    list.push(e);
    nakesByUnit.set(e.workUnitId, list);
  }

  const jobGradeWeight = new Map(jobGrades.map((g) => [g.id, g.weightBp]));
  const defaultWeightBp = 10000; // pegawai tanpa job grade tercatat dibobot setara 1x

  // Step A: pendapatan unit (pool) per unit kerja.
  const poolByUnit = new Map<string, number>();
  const poolComponents = new Map<string, CalculationComponent[]>();
  for (const tx of transactions) {
    if (!TEAM_ROLES.has(tx.serviceRole)) continue;
    const bp = findProportionBp(proportionRules, tx);
    if (bp === null) continue;
    const amount = percentOfBp(tx.tariffValue, bp);
    poolByUnit.set(tx.workUnitId, (poolByUnit.get(tx.workUnitId) ?? 0) + amount);
    const comps = poolComponents.get(tx.workUnitId) ?? [];
    comps.push({
      label: `Pool ${tx.serviceCategory} · ${tx.penjaminanStatus}`,
      basisAmount: tx.tariffValue,
      percentBp: bp,
      amount,
    });
    poolComponents.set(tx.workUnitId, comps);
  }

  const rows: TimUnitCalculationRow[] = [];

  if (!subsidy.enabled) {
    // 100% porsi tetap: seluruh pool unit didistribusikan hanya ke nakes unit itu sendiri.
    for (const [unitId, pool] of poolByUnit) {
      distributePool(unitId, pool, nakesByUnit.get(unitId) ?? [], jobGradeWeight, defaultWeightBp, rows, poolComponents.get(unitId) ?? []);
    }
    return rows;
  }

  // Subsidy pattern: split each unit's pool into a fixed portion (stays in
  // unit) and a subsidy portion (pooled hospital-wide, then redistributed
  // across every nakes employee weighted by job grade).
  let subsidyPool = 0;
  const fixedPortionByUnit = new Map<string, number>();
  for (const [unitId, pool] of poolByUnit) {
    const fixed = percentOfBp(pool, subsidy.fixedPortionBp);
    fixedPortionByUnit.set(unitId, fixed);
    subsidyPool += pool - fixed;
  }

  for (const [unitId, fixed] of fixedPortionByUnit) {
    distributePool(unitId, fixed, nakesByUnit.get(unitId) ?? [], jobGradeWeight, defaultWeightBp, rows, poolComponents.get(unitId) ?? [], "Porsi tetap");
  }

  const allNakes = [...nakesByUnit.values()].flat();
  distributePool("ALL", subsidyPool, allNakes, jobGradeWeight, defaultWeightBp, rows, [], "Porsi subsidi lintas unit");

  // merge duplicate rows per employee (an employee can receive both a fixed
  // portion and a subsidy portion in the same run)
  const merged = new Map<string, TimUnitCalculationRow>();
  for (const r of rows) {
    const existing = merged.get(r.employeeId);
    if (existing) {
      existing.grossAmount += r.grossAmount;
      existing.components.push(...r.components);
    } else {
      merged.set(r.employeeId, { ...r, components: [...r.components] });
    }
  }
  return [...merged.values()];
}

function distributePool(
  unitId: string,
  pool: number,
  unitEmployees: EngineEmployee[],
  jobGradeWeight: Map<string, number>,
  defaultWeightBp: number,
  rows: TimUnitCalculationRow[],
  poolComponents: CalculationComponent[],
  label = "Distribusi job grade",
) {
  if (pool <= 0 || unitEmployees.length === 0) return;
  const weights = unitEmployees.map((e) => (e.jobGradeId ? (jobGradeWeight.get(e.jobGradeId) ?? defaultWeightBp) : defaultWeightBp));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return;

  unitEmployees.forEach((e, i) => {
    const share = Math.round((pool * weights[i]!) / totalWeight);
    rows.push({
      employeeId: e.id,
      grossAmount: share,
      components: [
        ...(unitId === "ALL" ? [] : poolComponents),
        {
          label: `${label} (bobot ${weights[i]} / total ${totalWeight})`,
          basisAmount: pool,
          percentBp: Math.round((weights[i]! * 10000) / totalWeight),
          amount: share,
        },
      ],
    });
  });
}
