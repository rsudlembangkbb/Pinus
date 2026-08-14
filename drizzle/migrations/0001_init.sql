-- PINUS initial schema
-- Applied via: wrangler d1 migrations apply pinus-db --local|--remote

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS work_units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS job_grades (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  weight_factor INTEGER NOT NULL DEFAULT 10000,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  nip TEXT,
  nik TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  profession TEXT,
  work_unit_id TEXT REFERENCES work_units(id),
  position TEXT,
  job_grade_id TEXT REFERENCES job_grades(id),
  employment_status TEXT NOT NULL DEFAULT 'pns',
  is_active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT,
  synced_from_baraya_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS employees_nip_idx ON employees(nip);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  work_unit_id TEXT REFERENCES work_units(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS employee_identity_mappings (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  source_system TEXT NOT NULL,
  external_code TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS identity_mapping_source_code_idx ON employee_identity_mappings(source_system, external_code);

CREATE TABLE IF NOT EXISTS proportion_schemes (
  id TEXT PRIMARY KEY,
  work_unit_id TEXT NOT NULL REFERENCES work_units(id),
  payment_type TEXT NOT NULL,
  role TEXT NOT NULL,
  proportion_bps INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS proportion_schemes_lookup_idx ON proportion_schemes(work_unit_id, payment_type, role, effective_from);

CREATE TABLE IF NOT EXISTS indexing_weight_components (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  component_key TEXT NOT NULL,
  label TEXT NOT NULL,
  weight_bps INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS deduction_rules (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  attendance_record_type TEXT NOT NULL,
  deduction_bps INTEGER NOT NULL,
  requires_document INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS minimum_requirements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  minimum_amount INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS calculation_periods (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  bpjs_pending_policy TEXT NOT NULL DEFAULT 'accrual',
  jaspel_budget_cap INTEGER,
  opened_by TEXT REFERENCES users(id),
  published_at INTEGER,
  locked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  source TEXT NOT NULL,
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'uploaded',
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  committed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS import_batches_period_source_idx ON import_batches(period_id, source);

CREATE TABLE IF NOT EXISTS import_row_errors (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  row_number INTEGER NOT NULL,
  column_name TEXT,
  error_message TEXT NOT NULL,
  raw_data_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS service_transactions (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  batch_id TEXT REFERENCES import_batches(id),
  service_date TEXT NOT NULL,
  work_unit_id TEXT REFERENCES work_units(id),
  patient_ref_code TEXT,
  service_type TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  tariff_value INTEGER NOT NULL,
  employee_id TEXT REFERENCES employees(id),
  external_employee_code TEXT NOT NULL,
  role TEXT NOT NULL,
  bpjs_claim_number TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS service_transactions_period_idx ON service_transactions(period_id);
CREATE INDEX IF NOT EXISTS service_transactions_employee_idx ON service_transactions(employee_id);

CREATE TABLE IF NOT EXISTS bpjs_claims (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  batch_id TEXT REFERENCES import_batches(id),
  claim_number TEXT NOT NULL,
  submission_date TEXT,
  work_unit_id TEXT REFERENCES work_units(id),
  submitted_value INTEGER NOT NULL,
  status TEXT NOT NULL,
  realization_date TEXT,
  realization_value INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS bpjs_claims_period_claim_idx ON bpjs_claims(period_id, claim_number);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  batch_id TEXT REFERENCES import_batches(id),
  employee_id TEXT REFERENCES employees(id),
  external_employee_code TEXT NOT NULL,
  record_type TEXT NOT NULL,
  days_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS attendance_period_employee_idx ON attendance_records(period_id, employee_id);

CREATE TABLE IF NOT EXISTS performance_scores (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  batch_id TEXT REFERENCES import_batches(id),
  employee_id TEXT REFERENCES employees(id),
  external_employee_code TEXT NOT NULL,
  category TEXT NOT NULL,
  component_scores_json TEXT NOT NULL,
  final_score INTEGER NOT NULL,
  assessed_by TEXT,
  assessed_at TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS performance_period_employee_idx ON performance_scores(period_id, employee_id);

CREATE TABLE IF NOT EXISTS calculation_runs (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  run_number INTEGER NOT NULL,
  is_simulation INTEGER NOT NULL DEFAULT 0,
  parameter_snapshot_json TEXT NOT NULL,
  input_summary_json TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  total_gross_amount INTEGER,
  total_net_amount INTEGER,
  adjustment_factor_bps INTEGER,
  error_message TEXT,
  started_by TEXT REFERENCES users(id),
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS calculation_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES calculation_runs(id),
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  category TEXT NOT NULL,
  gross_amount INTEGER NOT NULL,
  deduction_amount INTEGER NOT NULL DEFAULT 0,
  minimum_topup_amount INTEGER NOT NULL DEFAULT 0,
  pagu_adjustment_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL,
  component_breakdown_json TEXT NOT NULL,
  is_estimate INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS calc_results_run_employee_idx ON calculation_results(run_id, employee_id);
CREATE INDEX IF NOT EXISTS calc_results_period_employee_idx ON calculation_results(period_id, employee_id);

CREATE TABLE IF NOT EXISTS calculation_corrections (
  id TEXT PRIMARY KEY,
  source_period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  target_period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  reason TEXT NOT NULL,
  original_amount INTEGER NOT NULL,
  corrected_amount INTEGER NOT NULL,
  delta_amount INTEGER NOT NULL,
  related_bpjs_claim_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  step_type TEXT NOT NULL,
  work_unit_id TEXT REFERENCES work_units(id),
  actor_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  acted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS approval_steps_period_step_idx ON approval_steps(period_id, step_type);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_user_id);
