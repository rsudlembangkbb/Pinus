/**
 * PRD 9.4: bila total hasil perhitungan melampaui pagu insentif kinerja
 * periode berjalan, seluruh penerima dipotong proporsional sampai total
 * pas dengan pagu. Basis-point factor (<=10000) is applied uniformly so the
 * cut is always traceable back to a single transparent number per period.
 */
export function computeAdjustmentFactorBp(totalAmount: number, paguAmount: number | null): number {
  if (paguAmount == null || totalAmount <= paguAmount) return 10000;
  if (paguAmount <= 0) return 0; // pagu exhausted entirely (e.g. by exempted minimum-requirement earners)
  return Math.floor((paguAmount * 10000) / totalAmount);
}
