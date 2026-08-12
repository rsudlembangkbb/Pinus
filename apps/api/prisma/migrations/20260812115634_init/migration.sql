-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN_JASPEL', 'VERIFIKATOR_UNIT', 'KEUANGAN', 'DIREKTUR', 'PEGAWAI', 'AUDITOR');

-- CreateEnum
CREATE TYPE "StaffCategory" AS ENUM ('MEDIS', 'KEPERAWATAN', 'NAKES_LAIN', 'ADMINISTRASI', 'STRUKTURAL');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PNS', 'PPPK', 'NON_ASN');

-- CreateEnum
CREATE TYPE "ServiceGuaranteeStatus" AS ENUM ('JKN', 'NON_JKN');

-- CreateEnum
CREATE TYPE "ServiceRole" AS ENUM ('DPJP', 'OPERATOR', 'CO_OPERATOR', 'ANESTESI', 'PELAKSANA');

-- CreateEnum
CREATE TYPE "ImportBatchType" AS ENUM ('SERVICE_TRANSACTION', 'ATTENDANCE', 'PERFORMANCE_SCORE');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'VALIDATION_FAILED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'COMMITTED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'PROCESSING', 'CALCULATED', 'UNIT_VERIFICATION', 'FINANCE_VERIFICATION', 'DIRECTOR_APPROVAL', 'FINAL', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApprovalStage" AS ENUM ('UNIT_VERIFICATION', 'FINANCE_VERIFICATION', 'DIRECTOR_APPROVAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeductionTrigger" AS ENUM ('DISCIPLINARY_ACTION', 'LEAVE_GE_1_MONTH', 'FIGHT_DURING_COACHING', 'TRAINING_GT_1_MONTH', 'STUDY_ASSIGNMENT_ABSENCE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MinimumRequirementLevel" AS ENUM ('DOKTER_SUBSPESIALIS', 'DOKTER_SPESIALIS', 'DOKTER_UMUM', 'PERAWAT_MAHIR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "employeeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceCategory" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_grades" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightScore" DECIMAL(10,4) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "staffCategory" "StaffCategory" NOT NULL,
    "profession" TEXT,
    "workUnitId" TEXT NOT NULL,
    "jobGradeId" TEXT,
    "position" TEXT,
    "employmentStatus" "EmploymentStatus" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "minimumRequirementLevel" "MinimumRequirementLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proportion_schemes" (
    "id" TEXT NOT NULL,
    "workUnitId" TEXT NOT NULL,
    "guaranteeStatus" "ServiceGuaranteeStatus" NOT NULL,
    "serviceRole" "ServiceRole" NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proportion_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_weights" (
    "id" TEXT NOT NULL,
    "variableCode" TEXT NOT NULL,
    "variableLabel" TEXT NOT NULL,
    "weightPercent" DECIMAL(6,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexing_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_scores" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "variableCode" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "scoredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indexing_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minimum_requirements" (
    "id" TEXT NOT NULL,
    "level" "MinimumRequirementLevel" NOT NULL,
    "minimumAmount" DECIMAL(16,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minimum_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deduction_rules" (
    "id" TEXT NOT NULL,
    "trigger" "DeductionTrigger" NOT NULL,
    "description" TEXT NOT NULL,
    "percentage" DECIMAL(6,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deduction_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workUnitId" TEXT,
    "guaranteeStatus" "ServiceGuaranteeStatus" NOT NULL,
    "tariffAmount" DECIMAL(16,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "type" "ImportBatchType" NOT NULL,
    "periodId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileStoragePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_transactions" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "workUnitId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "patientRmCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "guaranteeStatus" "ServiceGuaranteeStatus" NOT NULL,
    "tariffAmount" DECIMAL(16,2) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "serviceRole" "ServiceRole" NOT NULL,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "leaveDays" INTEGER NOT NULL DEFAULT 0,
    "leaveType" TEXT,
    "disciplinaryAction" BOOLEAN NOT NULL DEFAULT false,
    "disciplinaryNotes" TEXT,
    "fightDuringCoaching" BOOLEAN NOT NULL DEFAULT false,
    "trainingDays" INTEGER NOT NULL DEFAULT 0,
    "studyAssignmentAbsenceDaysPerWeek" INTEGER NOT NULL DEFAULT 0,
    "attendancePercent" DECIMAL(6,3) NOT NULL DEFAULT 100,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_scores" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "qualityScore" DECIMAL(6,3) NOT NULL,
    "notes" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "performanceBudgetCap" DECIMAL(18,2),
    "openedById" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_results" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "staffCategory" "StaffCategory" NOT NULL,
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "deductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paguAdjustmentFactor" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "minimumRequirementApplied" BOOLEAN NOT NULL DEFAULT false,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "components" JSONB NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "workUnitId" TEXT,
    "stage" "ApprovalStage" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "actorId" TEXT,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "work_units_code_key" ON "work_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "job_grades_code_key" ON "job_grades"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_nip_key" ON "employees"("nip");

-- CreateIndex
CREATE INDEX "employees_workUnitId_idx" ON "employees"("workUnitId");

-- CreateIndex
CREATE INDEX "employees_staffCategory_idx" ON "employees"("staffCategory");

-- CreateIndex
CREATE INDEX "proportion_schemes_workUnitId_guaranteeStatus_serviceRole_e_idx" ON "proportion_schemes"("workUnitId", "guaranteeStatus", "serviceRole", "effectiveFrom");

-- CreateIndex
CREATE INDEX "indexing_weights_variableCode_effectiveFrom_idx" ON "indexing_weights"("variableCode", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "indexing_scores_employeeId_periodId_variableCode_key" ON "indexing_scores"("employeeId", "periodId", "variableCode");

-- CreateIndex
CREATE INDEX "minimum_requirements_level_effectiveFrom_idx" ON "minimum_requirements"("level", "effectiveFrom");

-- CreateIndex
CREATE INDEX "deduction_rules_trigger_effectiveFrom_idx" ON "deduction_rules"("trigger", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_services_code_key" ON "tariff_services"("code");

-- CreateIndex
CREATE INDEX "tariff_services_code_idx" ON "tariff_services"("code");

-- CreateIndex
CREATE INDEX "import_batches_periodId_type_idx" ON "import_batches"("periodId", "type");

-- CreateIndex
CREATE INDEX "import_rows_batchId_status_idx" ON "import_rows"("batchId", "status");

-- CreateIndex
CREATE INDEX "service_transactions_periodId_workUnitId_idx" ON "service_transactions"("periodId", "workUnitId");

-- CreateIndex
CREATE INDEX "service_transactions_periodId_employeeId_idx" ON "service_transactions"("periodId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employeeId_periodId_key" ON "attendance_records"("employeeId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_scores_employeeId_periodId_key" ON "performance_scores"("employeeId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_periods_year_month_key" ON "calculation_periods"("year", "month");

-- CreateIndex
CREATE INDEX "calculation_results_periodId_staffCategory_idx" ON "calculation_results"("periodId", "staffCategory");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_results_periodId_employeeId_key" ON "calculation_results"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "approval_steps_periodId_stage_idx" ON "approval_steps"("periodId", "stage");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "work_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_jobGradeId_fkey" FOREIGN KEY ("jobGradeId") REFERENCES "job_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proportion_schemes" ADD CONSTRAINT "proportion_schemes_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "work_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indexing_scores" ADD CONSTRAINT "indexing_scores_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indexing_scores" ADD CONSTRAINT "indexing_scores_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_services" ADD CONSTRAINT "tariff_services_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "work_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "work_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_periods" ADD CONSTRAINT "calculation_periods_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "work_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "calculation_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
