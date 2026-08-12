import Decimal from "decimal.js";

export type GuaranteeStatus = "JKN" | "NON_JKN";
export type ServiceRoleCode = "DPJP" | "OPERATOR" | "CO_OPERATOR" | "ANESTESI" | "PELAKSANA";
export type StaffCategoryCode = "MEDIS" | "KEPERAWATAN" | "NAKES_LAIN" | "ADMINISTRASI" | "STRUKTURAL";
export type IndexingVariableCode =
  | "EXPERIENCE"
  | "SKILL"
  | "RISK"
  | "URGENCY"
  | "POSITION"
  | "PERFORMANCE";
export type DeductionTriggerCode =
  | "DISCIPLINARY_ACTION"
  | "LEAVE_GE_1_MONTH"
  | "FIGHT_DURING_COACHING"
  | "TRAINING_GT_1_MONTH"
  | "STUDY_ASSIGNMENT_ABSENCE";

export interface EmployeeInput {
  id: string;
  staffCategory: StaffCategoryCode;
  workUnitId: string;
  jobGradeWeight: Decimal.Value | null;
  minimumRequirementLevel: string | null;
}

export interface ServiceTransactionInput {
  id: string;
  employeeId: string;
  workUnitId: string;
  guaranteeStatus: GuaranteeStatus;
  serviceRole: ServiceRoleCode;
  tariffAmount: Decimal.Value;
}

export interface ProportionKey {
  workUnitId: string;
  guaranteeStatus: GuaranteeStatus;
  serviceRole: ServiceRoleCode;
}

/** Resolves the % in force for a work unit/payer-status/service-role combo, already time-sliced to the period. */
export type ProportionResolver = (key: ProportionKey) => Decimal.Value | null;

export interface AttendanceInput {
  employeeId: string;
  leaveDays: number;
  disciplinaryAction: boolean;
  fightDuringCoaching: boolean;
  trainingDays: number;
  studyAssignmentAbsenceDaysPerWeek: number;
  attendancePercent: Decimal.Value;
}

export interface PerformanceInput {
  employeeId: string;
  qualityScore: Decimal.Value; // 0-100, "kualitas pelaksanaan kegiatan"
}

export interface IndexingScoreInput {
  employeeId: string;
  variableCode: IndexingVariableCode;
  score: Decimal.Value; // 0-100 raw score, entered by direct supervisor
}

export interface IndexingWeightInput {
  variableCode: IndexingVariableCode;
  weightPercent: Decimal.Value;
}

export interface DeductionRuleInput {
  trigger: DeductionTriggerCode;
  percentage: Decimal.Value;
}

export interface MinimumRequirementInput {
  level: string;
  minimumAmount: Decimal.Value;
}

export interface UnitTeamSubsidyConfig {
  /** % of each unit's pool kept and distributed within that same unit. Remainder is pooled hospital-wide. */
  fixedPortionPercent: Decimal.Value;
}

export interface ComponentBreakdown {
  formula: string;
  staffCategory: StaffCategoryCode;
  grossAmount: string;
  grossDetail: unknown;
  deduction: { trigger: DeductionTriggerCode | null; percentage: string; amount: string };
  minimumRequirement: { applied: boolean; level: string | null; minimumAmount: string | null };
}

export interface EmployeeCalculationResult {
  employeeId: string;
  staffCategory: StaffCategoryCode;
  grossAmount: Decimal;
  deductionAmount: Decimal;
  netAmountBeforeAdjustment: Decimal;
  minimumRequirementApplied: boolean;
  components: ComponentBreakdown;
}
