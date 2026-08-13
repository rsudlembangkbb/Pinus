/**
 * Pure domain types for the Jaspel proportional calculation engine.
 * This module has zero dependency on Next.js, Workers bindings, or D1 -
 * it operates purely on plain data so it can be unit tested in isolation
 * and ported if the runtime ever changes (PRD 11.3).
 */

export type PaymentType = 'jkn' | 'non_jkn';
export type ServiceRole = 'operator' | 'co_operator' | 'anestesi' | 'dpjp' | 'pelaksana';
export type EmployeeCategory = 'medis' | 'keperawatan' | 'nakes_non_keperawatan' | 'administrasi' | 'struktural';

export interface ServiceTransactionInput {
  id: string;
  employeeId: string;
  workUnitId: string;
  paymentType: PaymentType;
  tariffValue: number; // integer rupiah
  role: ServiceRole;
  serviceType: string;
}

export interface ProportionSchemeInput {
  workUnitId: string;
  paymentType: PaymentType;
  role: string; // ServiceRole | 'unit_tim' | 'umum'
  proportionBps: number;
}

export interface CalculationLine {
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface EmployeeGrossResult {
  employeeId: string;
  category: EmployeeCategory;
  grossAmount: number;
  breakdown: CalculationLine[];
}

export interface UnitStaffMember {
  employeeId: string;
  workUnitId: string;
  category: EmployeeCategory;
  jobGradeWeightBps: number; // 10000 = baseline 1.0x
  attendanceFactorBps: number; // 10000 = full attendance, reduces effective weight
}

export interface UnitRevenue {
  workUnitId: string;
  totalRevenue: number; // sum of tariff values attributable to the unit's team pool
}

export interface TeamUnitConfig {
  proportionBps: number; // share of unit revenue allocated as the Jaspel pool for the unit team
  fixedPortionBps: number; // portion of the pool kept within the unit, distributed by weight
  // remaining (10000 - fixedPortionBps) is pooled across all units ("porsi subsidi antar-unit")
  // and redistributed to all team members proportional to weight, per PRD 9.2.
}

export interface AdministrationEmployeeScore {
  employeeId: string;
  finalScoreCentiPoints: number; // score scaled x100 for integer precision
}

export interface AttendanceDeductionInput {
  employeeId: string;
  recordType: string;
  daysCount: number; // scaled x100
}

export interface DeductionRuleInput {
  attendanceRecordType: string;
  deductionBps: number;
}

export interface MinimumRequirementInput {
  category: string;
  minimumAmount: number;
}

export interface EmployeeCalculationResult {
  employeeId: string;
  category: EmployeeCategory;
  grossAmount: number;
  deductionAmount: number;
  minimumTopupAmount: number;
  paguAdjustmentAmount: number;
  netAmount: number;
  breakdown: CalculationLine[];
  isEstimate: boolean;
}
