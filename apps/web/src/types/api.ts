export interface Period {
  id: string;
  name: string;
  year: number;
  month: number;
  status: string;
  performanceBudgetCap: string | null;
  administrativeBudget: string;
  unitTeamFixedPortionPercent: string;
  calculatedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  approvalSteps?: ApprovalStep[];
}

export interface ApprovalStep {
  id: string;
  periodId: string;
  workUnitId: string | null;
  workUnit?: { id: string; name: string } | null;
  stage: string;
  decision: string;
  actorId: string | null;
  actor?: { id: string; username: string; role: string } | null;
  notes: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface WorkUnit {
  id: string;
  code: string;
  name: string;
  serviceCategory: string;
  isActive: boolean;
}

export interface JobGrade {
  id: string;
  code: string;
  name: string;
  weightScore: string;
  description: string | null;
  isActive: boolean;
}

export interface Employee {
  id: string;
  nip: string;
  fullName: string;
  staffCategory: string;
  profession: string | null;
  workUnitId: string;
  workUnit: { id: string; code: string; name: string };
  jobGradeId: string | null;
  jobGrade: { id: string; code: string; name: string } | null;
  position: string | null;
  employmentStatus: string;
  isActive: boolean;
  startDate: string;
  minimumRequirementLevel: string | null;
}

export interface ProportionScheme {
  id: string;
  workUnitId: string;
  workUnit: { id: string; code: string; name: string };
  guaranteeStatus: string;
  serviceRole: string;
  percentage: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface DeductionRule {
  id: string;
  trigger: string;
  description: string;
  percentage: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CalculationResult {
  id: string;
  periodId: string;
  employeeId: string;
  employee: {
    id: string;
    fullName: string;
    nip: string;
    staffCategory: string;
    workUnit: { id: string; name: string };
  };
  staffCategory: string;
  grossAmount: string;
  deductionAmount: string;
  paguAdjustmentFactor: string;
  minimumRequirementApplied: boolean;
  netAmount: string;
  components: Record<string, unknown>;
  formulaVersion: string;
  calculatedAt: string;
  period?: { id: string; name: string; year: number; month: number; status: string };
}

export interface ImportBatch {
  id: string;
  type: string;
  periodId: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedAt: string | null;
  createdAt: string;
  uploadedBy?: { id: string; username: string };
}

export interface ImportRow {
  id: string;
  batchId: string;
  rowNumber: number;
  rawData: Record<string, string>;
  status: string;
  errors: string[] | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actor?: { id: string; username: string; email: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}
