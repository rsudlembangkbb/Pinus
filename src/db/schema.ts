import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

/**
 * Money columns are always INTEGER rupiah (whole currency units, never
 * REAL/FLOAT) per PRD section 6/11 to avoid floating point rounding drift
 * on a financial system. Percentages/weights are stored as basis points
 * (1/100 of a percent, i.e. 12.5% == 1250) for the same reason.
 */

const timestamps = {
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
};

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // super_admin | admin_jaspel | verifikator_unit | keuangan | direktur | pegawai | auditor
  name: text('name').notNull(),
  description: text('description'),
  ...timestamps
});

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id').references(() => employees.id),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id),
    workUnitId: text('work_unit_id').references(() => workUnits.id),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
    tokenVersion: integer('token_version').notNull().default(0),
    lastLoginAt: integer('last_login_at'),
    ...timestamps
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email)
  })
);

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

export const workUnits = sqliteTable('work_units', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // rawat_inap|rawat_jalan|igd|rawat_intensif|ibs|radiologi|lab_patologi|lab_khusus|rehab_medik|luar_kamar_operasi|administrasi|struktural|lainnya
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
});

export const jobGrades = sqliteTable('job_grades', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // tenaga_medis|tenaga_kesehatan|administrasi_struktural
  weightFactor: integer('weight_factor').notNull().default(10000), // basis points, 10000 = 1.00x baseline
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
});

export const employees = sqliteTable(
  'employees',
  {
    id: text('id').primaryKey(),
    nip: text('nip'),
    nik: text('nik'),
    name: text('name').notNull(),
    category: text('category').notNull(), // medis|keperawatan|nakes_non_keperawatan|administrasi|struktural
    profession: text('profession'),
    workUnitId: text('work_unit_id').references(() => workUnits.id),
    position: text('position'),
    jobGradeId: text('job_grade_id').references(() => jobGrades.id),
    employmentStatus: text('employment_status').notNull().default('pns'), // pns|pppk|non_asn
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    startDate: text('start_date'),
    syncedFromBarayaAt: integer('synced_from_baraya_at'),
    /** Links to minimum_requirements.category, e.g. 'dokter_spesialis'; null = not subject to a minimum floor. */
    minimumCategory: text('minimum_category'),
    ...timestamps
  },
  (t) => ({
    nipIdx: uniqueIndex('employees_nip_idx').on(t.nip)
  })
);

export const employeeIdentityMappings = sqliteTable(
  'employee_identity_mappings',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id),
    sourceSystem: text('source_system').notNull(), // simrs|baraya|bpjs|kinerja
    externalCode: text('external_code').notNull(),
    notes: text('notes'),
    ...timestamps
  },
  (t) => ({
    sourceCodeIdx: uniqueIndex('identity_mapping_source_code_idx').on(t.sourceSystem, t.externalCode)
  })
);

export const proportionSchemes = sqliteTable(
  'proportion_schemes',
  {
    id: text('id').primaryKey(),
    workUnitId: text('work_unit_id')
      .notNull()
      .references(() => workUnits.id),
    paymentType: text('payment_type').notNull(), // jkn|non_jkn
    role: text('role').notNull(), // operator|co_operator|anestesi|dpjp|pelaksana|unit_tim|umum
    proportionBps: integer('proportion_bps').notNull(), // basis points of tariff/claim value
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').references(() => users.id),
    ...timestamps
  },
  (t) => ({
    lookupIdx: index('proportion_schemes_lookup_idx').on(t.workUnitId, t.paymentType, t.role, t.effectiveFrom)
  })
);

export const indexingWeightComponents = sqliteTable('indexing_weight_components', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // administrasi_struktural|tenaga_kesehatan
  componentKey: text('component_key').notNull(), // pengalaman|keterampilan|risiko_kerja|kegawatdaruratan|jabatan|capaian_kinerja
  label: text('label').notNull(),
  weightBps: integer('weight_bps').notNull(), // basis points, sums to 10000 within a category
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
});

export const deductionRules = sqliteTable('deduction_rules', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  attendanceRecordType: text('attendance_record_type').notNull(), // maps to attendance_records.recordType
  deductionBps: integer('deduction_bps').notNull(), // basis points cut, e.g. 5000 = 50%
  requiresDocument: integer('requires_document', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  ...timestamps
});

export const minimumRequirements = sqliteTable('minimum_requirements', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // dokter_subspesialis|dokter_spesialis|dokter_umum|perawat_mahir|...
  minimumAmount: integer('minimum_amount').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
});

// ---------------------------------------------------------------------------
// Periods & multi-source import
// ---------------------------------------------------------------------------

export const calculationPeriods = sqliteTable(
  'calculation_periods',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // e.g. 2026-08
    label: text('label').notNull(), // e.g. Agustus 2026
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    status: text('status').notNull().default('draft'),
    // draft -> importing -> ready_to_calculate -> calculated -> verifying_unit ->
    // verifying_keuangan -> verifying_direktur -> approved -> published -> locked
    bpjsPendingPolicy: text('bpjs_pending_policy').notNull().default('accrual'), // accrual|cash|hybrid
    jaspelBudgetCap: integer('jaspel_budget_cap'),
    administrationAllocation: integer('administration_allocation'),
    teamUnitProportionBps: integer('team_unit_proportion_bps').notNull().default(3000),
    teamUnitFixedPortionBps: integer('team_unit_fixed_portion_bps').notNull().default(2000),
    hybridDiscountBps: integer('hybrid_discount_bps').notNull().default(8000),
    openedBy: text('opened_by').references(() => users.id),
    publishedAt: integer('published_at'),
    lockedAt: integer('locked_at'),
    ...timestamps
  }
);

export const importBatches = sqliteTable(
  'import_batches',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    source: text('source').notNull(), // simrs|bpjs|baraya|kinerja
    fileName: text('file_name').notNull(),
    r2Key: text('r2_key').notNull(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('uploaded'), // uploaded|processing|validated|committed|failed
    totalRows: integer('total_rows').notNull().default(0),
    successRows: integer('success_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    committedAt: integer('committed_at'),
    ...timestamps
  },
  (t) => ({
    periodSourceIdx: index('import_batches_period_source_idx').on(t.periodId, t.source)
  })
);

export const importRowErrors = sqliteTable('import_row_errors', {
  id: text('id').primaryKey(),
  batchId: text('batch_id')
    .notNull()
    .references(() => importBatches.id),
  rowNumber: integer('row_number').notNull(),
  columnName: text('column_name'),
  errorMessage: text('error_message').notNull(),
  rawDataJson: text('raw_data_json'),
  ...timestamps
});

export const serviceTransactions = sqliteTable(
  'service_transactions',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    batchId: text('batch_id').references(() => importBatches.id),
    serviceDate: text('service_date').notNull(),
    workUnitId: text('work_unit_id').references(() => workUnits.id),
    patientRefCode: text('patient_ref_code'),
    serviceType: text('service_type').notNull(),
    paymentType: text('payment_type').notNull(), // jkn|non_jkn
    tariffValue: integer('tariff_value').notNull(),
    employeeId: text('employee_id').references(() => employees.id),
    externalEmployeeCode: text('external_employee_code').notNull(),
    role: text('role').notNull(), // operator|co_operator|anestesi|dpjp|pelaksana
    bpjsClaimNumber: text('bpjs_claim_number'),
    ...timestamps
  },
  (t) => ({
    periodIdx: index('service_transactions_period_idx').on(t.periodId),
    employeeIdx: index('service_transactions_employee_idx').on(t.employeeId)
  })
);

export const bpjsClaims = sqliteTable(
  'bpjs_claims',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    batchId: text('batch_id').references(() => importBatches.id),
    claimNumber: text('claim_number').notNull(),
    submissionDate: text('submission_date'),
    workUnitId: text('work_unit_id').references(() => workUnits.id),
    submittedValue: integer('submitted_value').notNull(),
    status: text('status').notNull(), // diajukan|diverifikasi|dicairkan|pending|ditolak
    realizationDate: text('realization_date'),
    realizationValue: integer('realization_value'),
    ...timestamps
  },
  (t) => ({
    periodClaimIdx: index('bpjs_claims_period_claim_idx').on(t.periodId, t.claimNumber)
  })
);

export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    batchId: text('batch_id').references(() => importBatches.id),
    employeeId: text('employee_id').references(() => employees.id),
    externalEmployeeCode: text('external_employee_code').notNull(),
    recordType: text('record_type').notNull(), // hadir|cuti|sakit|izin|diklat|tugas_belajar|pembinaan_disiplin|perkelahian
    daysCount: integer('days_count').notNull().default(0), // stored *100 (2 decimal precision)
    note: text('note'),
    ...timestamps
  },
  (t) => ({
    periodEmployeeIdx: index('attendance_period_employee_idx').on(t.periodId, t.employeeId)
  })
);

export const performanceScores = sqliteTable(
  'performance_scores',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    batchId: text('batch_id').references(() => importBatches.id),
    employeeId: text('employee_id').references(() => employees.id),
    externalEmployeeCode: text('external_employee_code').notNull(),
    category: text('category').notNull(), // kpii_perawat|indeksing_administrasi|iki_job_grade
    componentScoresJson: text('component_scores_json').notNull(),
    finalScore: integer('final_score').notNull(), // scaled x100
    assessedBy: text('assessed_by'),
    assessedAt: text('assessed_at'),
    ...timestamps
  },
  (t) => ({
    periodEmployeeIdx: index('performance_period_employee_idx').on(t.periodId, t.employeeId)
  })
);

// ---------------------------------------------------------------------------
// Calculation engine output
// ---------------------------------------------------------------------------

export const calculationRuns = sqliteTable('calculation_runs', {
  id: text('id').primaryKey(),
  periodId: text('period_id')
    .notNull()
    .references(() => calculationPeriods.id),
  runNumber: integer('run_number').notNull(),
  isSimulation: integer('is_simulation', { mode: 'boolean' }).notNull().default(false),
  parameterSnapshotJson: text('parameter_snapshot_json').notNull(),
  inputSummaryJson: text('input_summary_json'),
  status: text('status').notNull().default('running'), // running|completed|failed
  totalGrossAmount: integer('total_gross_amount'),
  totalNetAmount: integer('total_net_amount'),
  adjustmentFactorBps: integer('adjustment_factor_bps'), // 10000 == no adjustment
  errorMessage: text('error_message'),
  startedBy: text('started_by').references(() => users.id),
  startedAt: integer('started_at').notNull().default(sql`(unixepoch())`),
  finishedAt: integer('finished_at')
});

export const calculationResults = sqliteTable(
  'calculation_results',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => calculationRuns.id),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id),
    category: text('category').notNull(), // medis|kesehatan|administrasi
    grossAmount: integer('gross_amount').notNull(),
    deductionAmount: integer('deduction_amount').notNull().default(0),
    minimumTopupAmount: integer('minimum_topup_amount').notNull().default(0),
    paguAdjustmentAmount: integer('pagu_adjustment_amount').notNull().default(0),
    netAmount: integer('net_amount').notNull(),
    componentBreakdownJson: text('component_breakdown_json').notNull(),
    isEstimate: integer('is_estimate', { mode: 'boolean' }).notNull().default(false),
    ...timestamps
  },
  (t) => ({
    runEmployeeIdx: index('calc_results_run_employee_idx').on(t.runId, t.employeeId),
    periodEmployeeIdx: index('calc_results_period_employee_idx').on(t.periodId, t.employeeId)
  })
);

export const calculationCorrections = sqliteTable('calculation_corrections', {
  id: text('id').primaryKey(),
  sourcePeriodId: text('source_period_id')
    .notNull()
    .references(() => calculationPeriods.id),
  targetPeriodId: text('target_period_id')
    .notNull()
    .references(() => calculationPeriods.id),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id),
  reason: text('reason').notNull(),
  originalAmount: integer('original_amount').notNull(),
  correctedAmount: integer('corrected_amount').notNull(),
  deltaAmount: integer('delta_amount').notNull(),
  relatedBpjsClaimNumber: text('related_bpjs_claim_number'),
  status: text('status').notNull().default('pending'), // pending|applied
  createdBy: text('created_by').references(() => users.id),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: integer('approved_at'),
  ...timestamps
});

// ---------------------------------------------------------------------------
// Workflow, notifications, audit
// ---------------------------------------------------------------------------

export const approvalSteps = sqliteTable(
  'approval_steps',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => calculationPeriods.id),
    stepType: text('step_type').notNull(), // verifikasi_unit|verifikasi_keuangan|persetujuan_direktur
    workUnitId: text('work_unit_id').references(() => workUnits.id),
    actorUserId: text('actor_user_id').references(() => users.id),
    status: text('status').notNull().default('pending'), // pending|approved|rejected
    notes: text('notes'),
    actedAt: integer('acted_at'),
    ...timestamps
  },
  (t) => ({
    periodStepIdx: index('approval_steps_period_step_idx').on(t.periodId, t.stepType)
  })
);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  ...timestamps
});

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id),
    actorName: text('actor_name'),
    action: text('action').notNull(), // create|update|delete|approve|reject|login|export|calculate
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    ipAddress: text('ip_address'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    entityIdx: index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    actorIdx: index('audit_logs_actor_idx').on(t.actorUserId)
  })
);
