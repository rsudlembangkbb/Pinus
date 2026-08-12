import { money, percentOf, sum, ZERO } from "./money";
import { ProportionResolver, ServiceTransactionInput } from "./types";

export interface MedicalStaffLineItem {
  transactionId: string;
  workUnitId: string;
  guaranteeStatus: string;
  serviceRole: string;
  tariffAmount: string;
  percentage: string;
  amount: string;
}

export interface MedicalStaffResult {
  employeeId: string;
  grossAmount: import("decimal.js").default;
  lineItems: MedicalStaffLineItem[];
}

/**
 * PRD §9.1 — Metode Proporsionalitas for tenaga medis: each service line the
 * employee participated in (as DPJP/operator/co-operator/anestesi/pelaksana)
 * contributes tariff x the proportion configured for that unit + payer
 * status (JKN/Non-JKN) + role. No performance target/cap applies here —
 * only the pagu-wide proportional adjustment in a later stage can reduce it.
 */
export function calculateMedicalStaff(
  transactions: ServiceTransactionInput[],
  resolveProportion: ProportionResolver,
): MedicalStaffResult[] {
  const byEmployee = new Map<string, ServiceTransactionInput[]>();
  for (const tx of transactions) {
    const list = byEmployee.get(tx.employeeId) ?? [];
    list.push(tx);
    byEmployee.set(tx.employeeId, list);
  }

  const results: MedicalStaffResult[] = [];
  for (const [employeeId, txs] of byEmployee) {
    const lineItems: MedicalStaffLineItem[] = [];
    for (const tx of txs) {
      const percentage = resolveProportion({
        workUnitId: tx.workUnitId,
        guaranteeStatus: tx.guaranteeStatus,
        serviceRole: tx.serviceRole,
      });
      if (percentage === null) continue; // no scheme configured — excluded, surfaced by validation upstream
      const amount = percentOf(tx.tariffAmount, percentage);
      lineItems.push({
        transactionId: tx.id,
        workUnitId: tx.workUnitId,
        guaranteeStatus: tx.guaranteeStatus,
        serviceRole: tx.serviceRole,
        tariffAmount: money(tx.tariffAmount).toString(),
        percentage: money(percentage).toString(),
        amount: amount.toString(),
      });
    }
    const grossAmount = sum(lineItems.map((l) => l.amount)) ?? ZERO;
    results.push({ employeeId, grossAmount, lineItems });
  }

  return results;
}
