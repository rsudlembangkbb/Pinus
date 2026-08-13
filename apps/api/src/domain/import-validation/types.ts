import type { ImportRowStatus } from "@pinus/shared";

export interface RowValidationResult<TMapped> {
  status: ImportRowStatus;
  errors: string[];
  mapped: TMapped | null;
}

export interface EmployeeRef {
  id: string;
  isActive: boolean;
}

export interface WorkUnitRef {
  id: string;
  isActive: boolean;
}

export interface ValidationContext {
  employeesByNip: Map<string, EmployeeRef>;
  workUnitsByCode: Map<string, WorkUnitRef>;
  periodYear: number;
  periodMonth: number;
}
