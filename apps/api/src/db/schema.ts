import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  text(name).notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const roles = sqliteTable("roles", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
});

export const permissions = sqliteTable("permissions", {
  code: text("code").primaryKey(),
  description: text("description"),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleCode: text("role_code").notNull().references(() => roles.code, { onDelete: "cascade" }),
    permissionCode: text("permission_code")
      .notNull()
      .references(() => permissions.code, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleCode, t.permissionCode] }) }),
);

export const workUnits = sqliteTable("work_units", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  serviceCategory: text("service_category").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const jobGrades = sqliteTable("job_grades", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  weightBp: integer("weight_bp").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const indexingWeights = sqliteTable("indexing_weights", {
  id: text("id").primaryKey(),
  variable: text("variable").notNull(),
  weightBp: integer("weight_bp").notNull(),
  maxScore: integer("max_score").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  nip: text("nip").notNull().unique(),
  fullName: text("full_name").notNull(),
  category: text("category").notNull(),
  profession: text("profession"),
  workUnitId: text("work_unit_id")
    .notNull()
    .references(() => workUnits.id),
  positionTitle: text("position_title"),
  jobGradeId: text("job_grade_id").references(() => jobGrades.id),
  employmentStatus: text("employment_status").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  startDate: text("start_date").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  roleCode: text("role_code")
    .notNull()
    .references(() => roles.code),
  employeeId: text("employee_id").references(() => employees.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  lastLoginAt: text("last_login_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at"),
});

export const userWorkUnits = sqliteTable(
  "user_work_units",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workUnitId: text("work_unit_id")
      .notNull()
      .references(() => workUnits.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.workUnitId] }) }),
);

export const proportionSchemes = sqliteTable("proportion_schemes", {
  id: text("id").primaryKey(),
  serviceCategory: text("service_category").notNull(),
  penjaminanStatus: text("penjaminan_status").notNull(),
  serviceRole: text("service_role"),
  percentBp: integer("percent_bp").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at"),
});

export const deductionRules = sqliteTable("deduction_rules", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  percentBp: integer("percent_bp").notNull(),
  description: text("description"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const minimumRequirements = sqliteTable("minimum_requirements", {
  id: text("id").primaryKey(),
  professionKey: text("profession_key").notNull(),
  label: text("label").notNull(),
  minAmount: integer("min_amount").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const tariffs = sqliteTable("tariffs", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  serviceCategory: text("service_category").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const calculationPeriods = sqliteTable("calculation_periods", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: text("status").notNull().default("DRAFT"),
  paguAmount: integer("pagu_amount"),
  administrasiAllocationAmount: integer("administrasi_allocation_amount"),
  exemptMinimumFromAdjustment: integer("exempt_minimum_from_adjustment", { mode: "boolean" }).notNull().default(false),
  adjustmentFactorBp: integer("adjustment_factor_bp"),
  openedBy: text("opened_by")
    .notNull()
    .references(() => users.id),
  openedAt: timestamp("opened_at"),
  calculatedAt: text("calculated_at"),
  lockedAt: text("locked_at"),
  lockedBy: text("locked_by").references(() => users.id),
  notes: text("notes"),
});

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  periodId: text("period_id")
    .notNull()
    .references(() => calculationPeriods.id),
  fileName: text("file_name").notNull(),
  fileR2Key: text("file_r2_key"),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp("uploaded_at"),
  status: text("status").notNull().default("UPLOADED"),
  totalRows: integer("total_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  committedAt: text("committed_at"),
  committedBy: text("committed_by").references(() => users.id),
});

export const importRows = sqliteTable("import_rows", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  rawJson: text("raw_json").notNull(),
  status: text("status").notNull(),
  errorsJson: text("errors_json").notNull().default("[]"),
  mappedEmployeeId: text("mapped_employee_id").references(() => employees.id),
  mappedWorkUnitId: text("mapped_work_unit_id").references(() => workUnits.id),
});

export const serviceTransactions = sqliteTable("service_transactions", {
  id: text("id").primaryKey(),
  periodId: text("period_id")
    .notNull()
    .references(() => calculationPeriods.id),
  serviceDate: text("service_date").notNull(),
  workUnitId: text("work_unit_id")
    .notNull()
    .references(() => workUnits.id),
  patientRef: text("patient_ref").notNull(),
  serviceName: text("service_name").notNull(),
  penjaminanStatus: text("penjaminan_status").notNull(),
  tariffValue: integer("tariff_value").notNull(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  serviceRole: text("service_role").notNull(),
  importBatchId: text("import_batch_id")
    .notNull()
    .references(() => importBatches.id),
  createdAt: timestamp("created_at"),
});

export const attendanceRecords = sqliteTable("attendance_records", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  periodId: text("period_id")
    .notNull()
    .references(() => calculationPeriods.id),
  leaveType: text("leave_type"),
  leaveDays: integer("leave_days"),
  deductionRuleCode: text("deduction_rule_code"),
  disciplinaryPercentBp: integer("disciplinary_percent_bp"),
  notes: text("notes"),
  importBatchId: text("import_batch_id").references(() => importBatches.id),
  createdAt: timestamp("created_at"),
});

export const performanceScores = sqliteTable(
  "performance_scores",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    periodId: text("period_id")
      .notNull()
      .references(() => calculationPeriods.id),
    variable: text("variable").notNull(),
    score: integer("score").notNull(),
    attendanceScore: integer("attendance_score"),
    qualityScore: integer("quality_score"),
    notes: text("notes"),
    scoredBy: text("scored_by")
      .notNull()
      .references(() => users.id),
    scoredAt: timestamp("scored_at"),
  },
  (t) => ({ uniqEmployeePeriodVar: unique().on(t.employeeId, t.periodId, t.variable) }),
);

export const calculationResults = sqliteTable(
  "calculation_results",
  {
    id: text("id").primaryKey(),
    periodId: text("period_id")
      .notNull()
      .references(() => calculationPeriods.id),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    engineKind: text("engine_kind").notNull(),
    grossAmount: integer("gross_amount").notNull(),
    deductionAmount: integer("deduction_amount").notNull().default(0),
    deductionRuleCodesJson: text("deduction_rule_codes_json").notNull().default("[]"),
    minimumRequirementApplied: integer("minimum_requirement_applied", { mode: "boolean" })
      .notNull()
      .default(false),
    minimumRequirementAmount: integer("minimum_requirement_amount"),
    adjustmentFactorBp: integer("adjustment_factor_bp").notNull().default(10000),
    netAmount: integer("net_amount").notNull(),
    componentsJson: text("components_json").notNull().default("[]"),
    calculatedAt: timestamp("calculated_at"),
  },
  (t) => ({ uniqPeriodEmployee: unique().on(t.periodId, t.employeeId) }),
);

export const approvalSteps = sqliteTable("approval_steps", {
  id: text("id").primaryKey(),
  periodId: text("period_id")
    .notNull()
    .references(() => calculationPeriods.id),
  stage: text("stage").notNull(),
  workUnitId: text("work_unit_id").references(() => workUnits.id),
  status: text("status").notNull().default("PENDING"),
  actedByUserId: text("acted_by_user_id").references(() => users.id),
  actedByName: text("acted_by_name"),
  actedAt: text("acted_at"),
  note: text("note"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at"),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  relatedPeriodId: text("related_period_id").references(() => calculationPeriods.id),
  createdAt: timestamp("created_at"),
});
