import { describe, expect, it } from 'vitest';
import { calculateMedisIncentives } from '@/domain/calculation/medis';
import { ProportionSchemeInput, ServiceTransactionInput } from '@/domain/calculation/types';

const schemes: ProportionSchemeInput[] = [
  { workUnitId: 'unit-igd', paymentType: 'non_jkn', role: 'dpjp', proportionBps: 6000 }, // 60%
  { workUnitId: 'unit-ibs', paymentType: 'jkn', role: 'operator', proportionBps: 1200 }, // 12%
  { workUnitId: 'unit-ibs', paymentType: 'jkn', role: 'co_operator', proportionBps: 700 } // 7%
];

describe('calculateMedisIncentives', () => {
  it('sums proportional amounts per employee across transactions', () => {
    const transactions: ServiceTransactionInput[] = [
      {
        id: 'tx1',
        employeeId: 'dr-a',
        workUnitId: 'unit-igd',
        paymentType: 'non_jkn',
        tariffValue: 500_000,
        role: 'dpjp',
        serviceType: 'Konsultasi IGD'
      },
      {
        id: 'tx2',
        employeeId: 'dr-a',
        workUnitId: 'unit-igd',
        paymentType: 'non_jkn',
        tariffValue: 300_000,
        role: 'dpjp',
        serviceType: 'Tindakan IGD'
      }
    ];

    const result = calculateMedisIncentives(transactions, schemes);
    expect(result).toHaveLength(1);
    expect(result[0]!.employeeId).toBe('dr-a');
    expect(result[0]!.grossAmount).toBe(300_000 + 180_000); // 60% of 500k + 60% of 300k
    expect(result[0]!.breakdown).toHaveLength(2);
  });

  it('splits operator vs co-operator proportions independently for the same procedure', () => {
    const transactions: ServiceTransactionInput[] = [
      {
        id: 'tx3',
        employeeId: 'dr-operator',
        workUnitId: 'unit-ibs',
        paymentType: 'jkn',
        tariffValue: 10_000_000,
        role: 'operator',
        serviceType: 'Operasi Appendiktomi'
      },
      {
        id: 'tx4',
        employeeId: 'dr-asisten',
        workUnitId: 'unit-ibs',
        paymentType: 'jkn',
        tariffValue: 10_000_000,
        role: 'co_operator',
        serviceType: 'Operasi Appendiktomi'
      }
    ];

    const result = calculateMedisIncentives(transactions, schemes);
    const operator = result.find((r) => r.employeeId === 'dr-operator');
    const asisten = result.find((r) => r.employeeId === 'dr-asisten');
    expect(operator?.grossAmount).toBe(1_200_000);
    expect(asisten?.grossAmount).toBe(700_000);
  });

  it('ignores transactions with no configured proportion scheme', () => {
    const transactions: ServiceTransactionInput[] = [
      {
        id: 'tx5',
        employeeId: 'dr-x',
        workUnitId: 'unit-radiologi',
        paymentType: 'jkn',
        tariffValue: 1_000_000,
        role: 'pelaksana',
        serviceType: 'Rontgen'
      }
    ];
    const result = calculateMedisIncentives(transactions, schemes);
    expect(result).toHaveLength(0);
  });
});
