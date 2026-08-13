export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN_JASPEL"
  | "VERIFIKATOR_UNIT"
  | "KEUANGAN"
  | "DIREKTUR"
  | "PEGAWAI"
  | "AUDITOR";

export type EmployeeCategory = "MEDIS" | "KESEHATAN" | "ADMINISTRASI" | "STRUKTURAL";
export type SchemePayer = "JKN" | "NON_JKN";
export type PeriodStatus =
  | "DRAFT"
  | "MENUNGGU_VERIFIKASI_UNIT"
  | "MENUNGGU_VERIFIKASI_KEUANGAN"
  | "MENUNGGU_PERSETUJUAN_DIREKTUR"
  | "FINAL";

export interface ApiErrorShape {
  error: string;
  details?: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  employeeId: string | null;
  workUnitId: string | null;
}

export interface DashboardSummary {
  activePeriod: {
    id: string;
    label: string;
    status: PeriodStatus;
  } | null;
  totals: {
    employees: number;
    transactions: number;
    importBatches: number;
    pendingApprovals: number;
    totalDistributed: number;
  };
  byCategory: Array<{
    category: EmployeeCategory;
    total: number;
    recipients: number;
  }>;
  byUnit: Array<{
    workUnitName: string;
    total: number;
  }>;
}

export interface WorkUnit {
  id: string;
  code: string;
  name: string;
  serviceType: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  category: EmployeeCategory;
  profession: string;
  workUnitId: string;
  workUnitName?: string;
  positionTitle: string;
  jobGradeCode: string | null;
  employmentStatus: string;
  isActive: number;
  createdAt: string;
}

export interface JobGrade {
  id: string;
  code: string;
  name: string;
  category: EmployeeCategory;
  distributionWeight: number;
  experienceWeight: number;
  skillWeight: number;
  riskWeight: number;
  emergencyWeight: number;
  performanceWeight: number;
}

export interface ProportionScheme {
  id: string;
  workUnitId: string | null;
  workUnitName?: string;
  employeeCategory: EmployeeCategory;
  payerType: SchemePayer | null;
  roleInService: string | null;
  percentage: number;
  fixedSharePercentage: number;
  subsidySharePercentage: number;
  effectiveStartDate: string;
}

export interface DeductionRule {
  id: string;
  code: string;
  name: string;
  percentage: number;
  description: string;
}

export interface CalculationPeriod {
  id: string;
  label: string;
  month: number;
  year: number;
  budgetMedical: number;
  budgetHealth: number;
  budgetAdmin: number;
  minimumSpecialist: number;
  minimumGeneralPractitioner: number;
  minimumSeniorNurse: number;
  status: PeriodStatus;
  publishedAt: string | null;
  createdAt: string;
}

export interface CalculationResult {
  id: string;
  periodId: string;
  employeeId: string;
  employeeName: string;
  employeeCategory: EmployeeCategory;
  workUnitName: string;
  grossAmount: number;
  deductionAmount: number;
  adjustmentAmount: number;
  finalAmount: number;
  breakdownJson: string;
}

export interface ApprovalStep {
  id: string;
  periodId: string;
  sequence: number;
  roleRequired: UserRole;
  workUnitId: string | null;
  workUnitName?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  actedAt: string | null;
  actorName?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  metadataJson: string;
}
