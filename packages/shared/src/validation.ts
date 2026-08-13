import { z } from "zod";
import {
  DEDUCTION_RULE_CODES,
  EMPLOYEE_CATEGORIES,
  EMPLOYMENT_STATUSES,
  INDEXING_VARIABLES,
  PENJAMINAN_STATUSES,
  SERVICE_CATEGORIES,
  SERVICE_ROLES,
} from "./enums.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

export const employeeSchema = z.object({
  nip: z.string().min(3).max(32),
  fullName: z.string().min(2).max(200),
  category: z.enum(EMPLOYEE_CATEGORIES),
  profession: z.string().max(100).nullable().optional(),
  workUnitId: z.string().uuid(),
  positionTitle: z.string().max(150).nullable().optional(),
  jobGradeId: z.string().uuid().nullable().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES),
  isActive: z.boolean().default(true),
  startDate: isoDate,
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const workUnitSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(150),
  serviceCategory: z.enum(SERVICE_CATEGORIES),
  isActive: z.boolean().default(true),
});
export type WorkUnitInput = z.infer<typeof workUnitSchema>;

export const proportionSchemeSchema = z.object({
  serviceCategory: z.enum(SERVICE_CATEGORIES),
  penjaminanStatus: z.enum(PENJAMINAN_STATUSES),
  serviceRole: z.enum(SERVICE_ROLES).nullable().optional(),
  percentBp: z.number().int().min(0).max(10000),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type ProportionSchemeInput = z.infer<typeof proportionSchemeSchema>;

export const jobGradeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(100),
  weightBp: z.number().int().min(0).max(1000000),
  description: z.string().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type JobGradeInput = z.infer<typeof jobGradeSchema>;

export const indexingWeightSchema = z.object({
  variable: z.enum(INDEXING_VARIABLES),
  weightBp: z.number().int().min(0).max(10000),
  maxScore: z.number().int().min(1).max(1000),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
});
export type IndexingWeightInput = z.infer<typeof indexingWeightSchema>;

export const deductionRuleSchema = z.object({
  code: z.enum(DEDUCTION_RULE_CODES),
  name: z.string().min(2).max(150),
  percentBp: z.number().int().min(0).max(10000),
  description: z.string().max(500).nullable().optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  isActive: z.boolean().default(true),
});
export type DeductionRuleInput = z.infer<typeof deductionRuleSchema>;

export const minimumRequirementSchema = z.object({
  professionKey: z.string().min(2).max(100),
  label: z.string().min(2).max(150),
  minAmount: z.number().int().min(0),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
});
export type MinimumRequirementInput = z.infer<typeof minimumRequirementSchema>;

export const tariffSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(200),
  serviceCategory: z.enum(SERVICE_CATEGORIES),
  isActive: z.boolean().default(true),
});
export type TariffInput = z.infer<typeof tariffSchema>;

export const createPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  paguAmount: z.number().int().min(0).nullable().optional(),
  administrasiAllocationAmount: z.number().int().min(0).nullable().optional(),
  exemptMinimumFromAdjustment: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;

export const approvalActionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).nullable().optional(),
  workUnitId: z.string().uuid().optional(),
});
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;

export const userCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(200),
  roleCode: z.string(),
  employeeId: z.string().uuid().nullable().optional(),
  password: z.string().min(8).optional(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  roleCode: z.string().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
