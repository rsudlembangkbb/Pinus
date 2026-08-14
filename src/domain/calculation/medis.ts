import { applyBps } from '@/lib/money';
import { CalculationLine, EmployeeGrossResult, ProportionSchemeInput, ServiceTransactionInput } from './types';

/**
 * Metode Proporsionalitas for tenaga medis (PRD 5.3.1 / 9.1): each service
 * transaction's tariff/claim value is multiplied by the proportion
 * percentage configured for (unit, payment type, role), then summed per
 * employee. Not subject to a performance target - purely volume x rate.
 */
export function calculateMedisIncentives(
  transactions: ServiceTransactionInput[],
  schemes: ProportionSchemeInput[]
): EmployeeGrossResult[] {
  const schemeIndex = new Map<string, number>();
  for (const s of schemes) {
    schemeIndex.set(schemeKey(s.workUnitId, s.paymentType, s.role), s.proportionBps);
  }

  const perEmployee = new Map<string, { total: number; lines: CalculationLine[] }>();

  for (const tx of transactions) {
    const bps = schemeIndex.get(schemeKey(tx.workUnitId, tx.paymentType, tx.role));
    if (bps === undefined) {
      // No configured proportion for this combination -> contributes nothing,
      // but the caller should surface this as a data-quality warning upstream.
      continue;
    }
    const amount = applyBps(tx.tariffValue, bps);
    const entry = perEmployee.get(tx.employeeId) ?? { total: 0, lines: [] };
    entry.total += amount;
    entry.lines.push({
      label: `${tx.serviceType} (${tx.role}, ${tx.paymentType.toUpperCase()})`,
      amount,
      meta: { transactionId: tx.id, tariffValue: tx.tariffValue, proportionBps: bps }
    });
    perEmployee.set(tx.employeeId, entry);
  }

  return Array.from(perEmployee.entries()).map(([employeeId, v]) => ({
    employeeId,
    category: 'medis',
    grossAmount: v.total,
    breakdown: v.lines
  }));
}

function schemeKey(workUnitId: string, paymentType: string, role: string): string {
  return `${workUnitId}::${paymentType}::${role}`;
}
