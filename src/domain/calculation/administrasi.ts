import { AdministrationEmployeeScore, CalculationLine, EmployeeGrossResult } from './types';

/**
 * Tenaga Administrasi/Struktural indexing per PRD 5.3.3 / 9.3:
 *   Insentif = Alokasi x (Skor Individu / Total Skor)
 * Uses the largest-remainder method so the sum of all shares exactly
 * equals the allocation (integer Rupiah), rather than drifting from
 * independent per-employee rounding.
 */
export function calculateAdministrationIncentives(
  allocation: number,
  scores: AdministrationEmployeeScore[]
): EmployeeGrossResult[] {
  const totalScore = scores.reduce((acc, s) => acc + s.finalScoreCentiPoints, 0);
  if (totalScore <= 0 || allocation <= 0 || scores.length === 0) {
    return scores.map((s) => ({
      employeeId: s.employeeId,
      category: 'administrasi',
      grossAmount: 0,
      breakdown: [{ label: 'Skor kinerja tidak tersedia', amount: 0 }]
    }));
  }

  const raw = scores.map((s) => {
    const exact = (allocation * s.finalScoreCentiPoints) / totalScore;
    const floor = Math.floor(exact);
    return { employeeId: s.employeeId, score: s.finalScoreCentiPoints, floor, remainder: exact - floor };
  });

  let distributed = raw.reduce((acc, r) => acc + r.floor, 0);
  let remaining = allocation - distributed;

  const byRemainderDesc = [...raw].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < byRemainderDesc.length && remaining > 0; i++, remaining--) {
    byRemainderDesc[i]!.floor += 1;
  }

  const finalAmounts = new Map(raw.map((r) => [r.employeeId, r.floor]));

  return scores.map((s): EmployeeGrossResult => {
    const amount = finalAmounts.get(s.employeeId) ?? 0;
    const line: CalculationLine = {
      label: 'Indeksing tenaga administrasi/struktural',
      amount,
      meta: { score: s.finalScoreCentiPoints, totalScore, allocation }
    };
    return { employeeId: s.employeeId, category: 'administrasi', grossAmount: amount, breakdown: [line] };
  });
}
