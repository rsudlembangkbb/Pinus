import type {
  CalculationComponent,
  CalculationEngineKind,
  DeductionRuleCode,
  EmployeeCategory,
  IndexingVariable,
  PenjaminanStatus,
  ServiceCategory,
  ServiceRole,
} from "@pinus/shared";

// Pure domain input/output shapes for the calculation engine. Deliberately
// decoupled from the D1 schema and from the shared API entities: the API
// layer is responsible for querying the database, resolving what is
// "effective" as of the period's reference date, and mapping rows into
// these plain objects. That boundary is what makes the engine testable with
// zero database/HTTP dependency (PRD section 11.3).

export interface EngineEmployee {
  id: string;
  category: EmployeeCategory;
  profession: string | null;
  workUnitId: string;
  jobGradeId: string | null;
  isActive: boolean;
}

export interface EngineTransaction {
  id: string;
  employeeId: string;
  workUnitId: string;
  serviceCategory: ServiceCategory;
  penjaminanStatus: PenjaminanStatus;
  serviceRole: ServiceRole;
  tariffValue: number;
}

export interface EngineProportionRule {
  serviceCategory: ServiceCategory;
  penjaminanStatus: PenjaminanStatus;
  /** null = applies to any service role not otherwise matched by a more specific rule. */
  serviceRole: ServiceRole | null;
  percentBp: number;
}

export interface EngineJobGrade {
  id: string;
  weightBp: number;
}

export interface EngineDeductionRule {
  code: DeductionRuleCode;
  percentBp: number;
}

export interface EngineEmployeeDeduction {
  employeeId: string;
  ruleCode: DeductionRuleCode;
  /** Explicit override, used by PEMBINAAN_DISIPLIN whose percentage is set case-by-case by the disciplinary decree rather than a fixed master value. */
  overridePercentBp?: number;
}

export interface EngineMinimumRequirement {
  /** Matched case-insensitively against EngineEmployee.profession. */
  professionKey: string;
  minAmount: number;
}

export interface EngineIndexingWeight {
  variable: IndexingVariable;
  weightBp: number;
  maxScore: number;
}

export interface EnginePerformanceScore {
  employeeId: string;
  variable: IndexingVariable;
  score: number;
  attendanceScore?: number | null;
  qualityScore?: number | null;
}

/** Team-unit (nakes) subsidy pattern -- see PRD 9.2. Disabled by default. */
export interface SubsidyConfig {
  enabled: boolean;
  fixedPortionBp: number; // portion kept within the originating unit
}

export interface CalculationEngineInput {
  employees: EngineEmployee[];
  transactions: EngineTransaction[];
  proportionRules: EngineProportionRule[];
  jobGrades: EngineJobGrade[];
  deductionRules: EngineDeductionRule[];
  employeeDeductions: EngineEmployeeDeduction[];
  minimumRequirements: EngineMinimumRequirement[];
  indexingWeights: EngineIndexingWeight[];
  performanceScores: EnginePerformanceScore[];
  /** Total insentif kinerja pool available to tenaga administrasi/struktural for the period. */
  administrasiAllocationAmount: number;
  /** Total insentif kinerja pool for the whole period (all categories combined); null = no cap configured. */
  paguAmount: number | null;
  /**
   * Whether employees whose net was raised to the minimum-requirement floor
   * are exempt from the pagu proportional cut. PRD 9.4 literally says the
   * adjustment applies to "seluruh penerima" (all recipients), so this
   * defaults to false; RSUD Lembang management can flip it once policy is
   * confirmed without any code change.
   */
  exemptMinimumFromAdjustment: boolean;
  subsidy?: SubsidyConfig;
}

export interface EmployeeCalculationResult {
  employeeId: string;
  engineKind: CalculationEngineKind;
  grossAmount: number;
  deductionAmount: number;
  deductionRuleCodes: DeductionRuleCode[];
  minimumRequirementApplied: boolean;
  minimumRequirementAmount: number | null;
  adjustmentFactorBp: number;
  netAmount: number;
  components: CalculationComponent[];
}

export interface CalculationEngineOutput {
  results: EmployeeCalculationResult[];
  totalBeforeAdjustment: number;
  totalAfterAdjustment: number;
  adjustmentFactorBp: number;
  paguExceeded: boolean;
}
