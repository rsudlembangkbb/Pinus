export type Role =
  | "SUPER_ADMIN"
  | "ADMIN_JASPEL"
  | "VERIFIER_UNIT"
  | "FINANCE"
  | "DIRECTOR"
  | "EMPLOYEE"
  | "AUDITOR";

export type WorkUnit = {
  id: string;
  code: string;
  name: string;
  serviceType: string;
};

export type JobGrade = {
  id: string;
  code: string;
  name: string;
  weight: string;
};

export type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  category: string;
  profession?: string | null;
  position?: string | null;
  minimumGuarantee?: string | null;
  workUnit: WorkUnit;
  jobGrade?: JobGrade | null;
};

export type Period = {
  id: string;
  month: number;
  year: number;
  label: string;
  budgetCap: string;
  healthcarePool: string;
  administrativePool: string;
  status: string;
  approvals?: Array<{
    id: string;
    level: string;
    status: string;
    note?: string | null;
  }>;
  _count?: {
    results: number;
    transactions: number;
  };
};

export type AuthProfile = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: Role;
  employeeId?: string | null;
  workUnitId?: string | null;
  employee?: Employee | null;
  workUnit?: WorkUnit | null;
};

export type CalculationResult = {
  id: string;
  periodId: string;
  grossAmount: string;
  deductionAmount: string;
  adjustmentAmount: string;
  finalAmount: string;
  details: Record<string, unknown>;
  employee: Employee;
  workUnit: WorkUnit;
};

export type PeriodDetail = Period & {
  results: CalculationResult[];
};

export type BootstrapData = {
  units: WorkUnit[];
  grades: JobGrade[];
  periods: Period[];
  summary: DashboardSummary;
};

export type DashboardSummary = {
  latestPeriod: PeriodDetail | null;
  totals: {
    total: number;
    byCategory: Record<string, number>;
  };
  myLatest: {
    finalAmount: string;
    period: Period;
  } | null;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor?: {
    fullName: string;
  } | null;
};
