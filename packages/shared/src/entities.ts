import type {
  ApprovalStage,
  ApprovalStatus,
  AuditAction,
  CalculationEngineKind,
  DeductionRuleCode,
  EmployeeCategory,
  EmploymentStatus,
  ImportBatchKind,
  ImportBatchStatus,
  ImportRowStatus,
  IndexingVariable,
  NotificationKind,
  PenjaminanStatus,
  PeriodStatus,
  RoleCode,
  ServiceCategory,
  ServiceRole,
} from "./enums.js";

// All API-facing entity shapes. Money is always an integer number of Rupiah
// (no sub-unit in practice; never a float with implied cents). Percentages
// and other fractional configuration values are integer "basis points"
// (1 bp = 0.01%, so 10000 bp = 100%) -- this is what lets the calculation
// engine stay on exact integer/bigint math end to end (see
// apps/api/src/domain/calculation-engine/money.ts). Dates are ISO 8601
// strings (YYYY-MM-DD or full timestamp).

export interface User {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  employeeId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  nip: string;
  fullName: string;
  category: EmployeeCategory;
  profession: string | null;
  workUnitId: string;
  positionTitle: string | null;
  jobGradeId: string | null;
  employmentStatus: EmploymentStatus;
  isActive: boolean;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkUnit {
  id: string;
  code: string;
  name: string;
  serviceCategory: ServiceCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProportionScheme {
  id: string;
  serviceCategory: ServiceCategory;
  penjaminanStatus: PenjaminanStatus;
  serviceRole: ServiceRole | null;
  percentBp: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface JobGrade {
  id: string;
  code: string;
  name: string;
  weightBp: number;
  description: string | null;
  isActive: boolean;
}

export interface IndexingWeight {
  id: string;
  variable: IndexingVariable;
  weightBp: number;
  maxScore: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface DeductionRule {
  id: string;
  code: DeductionRuleCode;
  name: string;
  percentBp: number;
  description: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface Tariff {
  id: string;
  code: string;
  name: string;
  serviceCategory: ServiceCategory;
  isActive: boolean;
}

export interface ImportBatch {
  id: string;
  kind: ImportBatchKind;
  periodId: string;
  fileName: string;
  fileR2Key: string | null;
  uploadedBy: string;
  uploadedAt: string;
  status: ImportBatchStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
  committedAt: string | null;
  committedBy: string | null;
}

export interface ImportRow {
  id: string;
  batchId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  status: ImportRowStatus;
  errors: string[];
  mappedEmployeeId: string | null;
  mappedWorkUnitId: string | null;
}

export interface ServiceTransaction {
  id: string;
  periodId: string;
  serviceDate: string;
  workUnitId: string;
  patientRef: string;
  serviceName: string;
  penjaminanStatus: PenjaminanStatus;
  tariffValue: number;
  employeeId: string;
  serviceRole: ServiceRole;
  importBatchId: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  periodId: string;
  leaveType: string | null;
  leaveDays: number | null;
  deductionRuleCode: DeductionRuleCode | null;
  disciplinaryPercentBp: number | null;
  notes: string | null;
  importBatchId: string | null;
  createdAt: string;
}

export interface PerformanceScore {
  id: string;
  employeeId: string;
  periodId: string;
  variable: IndexingVariable;
  score: number;
  attendanceScore: number | null;
  qualityScore: number | null;
  notes: string | null;
  scoredBy: string;
  scoredAt: string;
}

export interface CalculationPeriod {
  id: string;
  code: string;
  label: string;
  year: number;
  month: number;
  status: PeriodStatus;
  paguAmount: number | null;
  adjustmentFactorBp: number | null;
  openedBy: string;
  openedAt: string;
  calculatedAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  notes: string | null;
}

export interface CalculationComponent {
  label: string;
  basisAmount: number;
  percentBp: number | null;
  amount: number;
}

export interface CalculationResult {
  id: string;
  periodId: string;
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
  calculatedAt: string;
}

export interface ApprovalStep {
  id: string;
  periodId: string;
  stage: ApprovalStage;
  workUnitId: string | null;
  status: ApprovalStatus;
  actedByUserId: string | null;
  actedByName: string | null;
  actedAt: string | null;
  note: string | null;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  isRead: boolean;
  relatedPeriodId: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
