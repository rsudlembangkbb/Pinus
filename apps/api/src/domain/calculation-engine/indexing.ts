import { percentOfBp, type CalculationComponent } from "@pinus/shared";
import type {
  EngineEmployee,
  EngineIndexingWeight,
  EnginePerformanceScore,
} from "./types.js";

export interface IndexingCalculationRow {
  employeeId: string;
  grossAmount: number;
  components: CalculationComponent[];
}

const ADMIN_CATEGORIES = new Set(["ADMINISTRASI", "STRUKTURAL"]);
const ATTENDANCE_WEIGHT_BP = 4000; // 40%
const QUALITY_WEIGHT_BP = 6000; // 60%

/**
 * Tenaga administrasi/struktural (PRD 9.3): insentif = alokasi total x
 * (skor individu / total skor seluruh pegawai administrasi). Skor individu
 * = jumlah (skor/maxScore x bobot variabel); variabel CAPAIAN_KINERJA
 * sendiri adalah komposit kehadiran 40% + kualitas kerja 60%.
 */
export function calculateIndexing(
  employees: EngineEmployee[],
  weights: EngineIndexingWeight[],
  scores: EnginePerformanceScore[],
  allocationAmount: number,
): IndexingCalculationRow[] {
  const adminEmployees = employees.filter((e) => e.isActive && ADMIN_CATEGORIES.has(e.category));
  if (adminEmployees.length === 0 || allocationAmount <= 0) return [];

  const scoresByEmployee = new Map<string, EnginePerformanceScore[]>();
  for (const s of scores) {
    const list = scoresByEmployee.get(s.employeeId) ?? [];
    list.push(s);
    scoresByEmployee.set(s.employeeId, list);
  }

  const individualScoreFraction = new Map<string, number>(); // 0..1 composite, weighted

  for (const e of adminEmployees) {
    const empScores = scoresByEmployee.get(e.id) ?? [];
    let fraction = 0;
    for (const w of weights) {
      const s = empScores.find((x) => x.variable === w.variable);
      if (!s) continue;
      let variableFraction: number;
      if (w.variable === "CAPAIAN_KINERJA" && s.attendanceScore != null && s.qualityScore != null) {
        const attendanceFraction = s.attendanceScore / w.maxScore;
        const qualityFraction = s.qualityScore / w.maxScore;
        variableFraction =
          (attendanceFraction * ATTENDANCE_WEIGHT_BP + qualityFraction * QUALITY_WEIGHT_BP) / 10000;
      } else {
        variableFraction = s.score / w.maxScore;
      }
      fraction += variableFraction * (w.weightBp / 10000);
    }
    individualScoreFraction.set(e.id, fraction);
  }

  const totalScore = [...individualScoreFraction.values()].reduce((a, b) => a + b, 0);
  if (totalScore <= 0) return [];

  const rows: IndexingCalculationRow[] = [];
  for (const e of adminEmployees) {
    const fraction = individualScoreFraction.get(e.id) ?? 0;
    if (fraction <= 0) continue;
    const shareBp = Math.round((fraction / totalScore) * 10000);
    const amount = percentOfBp(allocationAmount, shareBp);
    rows.push({
      employeeId: e.id,
      grossAmount: amount,
      components: [
        {
          label: `Indeksing skor individu (${(fraction * 100).toFixed(2)} dari total ${(totalScore * 100).toFixed(2)})`,
          basisAmount: allocationAmount,
          percentBp: shareBp,
          amount,
        },
      ],
    });
  }
  return rows;
}
