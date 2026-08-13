-- PINUS core schema (D1 / SQLite dialect).
-- Money columns are always INTEGER Rupiah. Percentage/weight columns are
-- INTEGER basis points (1 bp = 0.01%). JSON payloads are stored as TEXT.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE permissions (
  code TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE role_permissions (
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------
CREATE TABLE work_units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE job_grades (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  weight_bp INTEGER NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE indexing_weights (
  id TEXT PRIMARY KEY,
  variable TEXT NOT NULL,
  weight_bp INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  nip TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  category TEXT NOT NULL,
  profession TEXT,
  work_unit_id TEXT NOT NULL REFERENCES work_units(id),
  position_title TEXT,
  job_grade_id TEXT REFERENCES job_grades(id),
  employment_status TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_employees_work_unit ON employees(work_unit_id);
CREATE INDEX idx_employees_category ON employees(category);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES roles(code),
  employee_id TEXT REFERENCES employees(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_users_role ON users(role_code);
CREATE INDEX idx_users_employee ON users(employee_id);

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Verifikator Unit accounts are scoped to one or more work units.
CREATE TABLE user_work_units (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_unit_id TEXT NOT NULL REFERENCES work_units(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, work_unit_id)
);

CREATE TABLE proportion_schemes (
  id TEXT PRIMARY KEY,
  service_category TEXT NOT NULL,
  penjaminan_status TEXT NOT NULL,
  service_role TEXT,
  percent_bp INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_proportion_lookup ON proportion_schemes(service_category, penjaminan_status, service_role, effective_from);

CREATE TABLE deduction_rules (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  percent_bp INTEGER NOT NULL,
  description TEXT,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_deduction_rules_code ON deduction_rules(code, effective_from);

CREATE TABLE minimum_requirements (
  id TEXT PRIMARY KEY,
  profession_key TEXT NOT NULL,
  label TEXT NOT NULL,
  min_amount INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_min_req_profession ON minimum_requirements(profession_key, effective_from);

CREATE TABLE tariffs (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Periods & workflow
-- ---------------------------------------------------------------------------
CREATE TABLE calculation_periods (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- e.g. '2026-08'
  label TEXT NOT NULL,       -- e.g. 'Agustus 2026'
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  pagu_amount INTEGER,
  administrasi_allocation_amount INTEGER,
  exempt_minimum_from_adjustment INTEGER NOT NULL DEFAULT 0,
  adjustment_factor_bp INTEGER,
  opened_by TEXT NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  calculated_at TEXT,
  locked_at TEXT,
  locked_by TEXT REFERENCES users(id),
  notes TEXT
);

CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  file_name TEXT NOT NULL,
  file_r2_key TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  committed_at TEXT,
  committed_by TEXT REFERENCES users(id)
);
CREATE INDEX idx_import_batches_period ON import_batches(period_id, kind);

CREATE TABLE import_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  status TEXT NOT NULL,
  errors_json TEXT NOT NULL DEFAULT '[]',
  mapped_employee_id TEXT REFERENCES employees(id),
  mapped_work_unit_id TEXT REFERENCES work_units(id)
);
CREATE INDEX idx_import_rows_batch ON import_rows(batch_id, status);

CREATE TABLE service_transactions (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  service_date TEXT NOT NULL,
  work_unit_id TEXT NOT NULL REFERENCES work_units(id),
  patient_ref TEXT NOT NULL,
  service_name TEXT NOT NULL,
  penjaminan_status TEXT NOT NULL,
  tariff_value INTEGER NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  service_role TEXT NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_service_tx_period_employee ON service_transactions(period_id, employee_id);
CREATE INDEX idx_service_tx_period_unit ON service_transactions(period_id, work_unit_id);
CREATE INDEX idx_service_tx_dedup ON service_transactions(period_id, service_date, work_unit_id, patient_ref, employee_id, service_role, service_name);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  leave_type TEXT,
  leave_days INTEGER,
  deduction_rule_code TEXT,
  disciplinary_percent_bp INTEGER,
  notes TEXT,
  import_batch_id TEXT REFERENCES import_batches(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_attendance_period_employee ON attendance_records(period_id, employee_id);

CREATE TABLE performance_scores (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  variable TEXT NOT NULL,
  score INTEGER NOT NULL,
  attendance_score INTEGER,
  quality_score INTEGER,
  notes TEXT,
  scored_by TEXT NOT NULL REFERENCES users(id),
  scored_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(employee_id, period_id, variable)
);
CREATE INDEX idx_perf_period_employee ON performance_scores(period_id, employee_id);

CREATE TABLE calculation_results (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  engine_kind TEXT NOT NULL,
  gross_amount INTEGER NOT NULL,
  deduction_amount INTEGER NOT NULL DEFAULT 0,
  deduction_rule_codes_json TEXT NOT NULL DEFAULT '[]',
  minimum_requirement_applied INTEGER NOT NULL DEFAULT 0,
  minimum_requirement_amount INTEGER,
  adjustment_factor_bp INTEGER NOT NULL DEFAULT 10000,
  net_amount INTEGER NOT NULL,
  components_json TEXT NOT NULL DEFAULT '[]',
  calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(period_id, employee_id)
);
CREATE INDEX idx_calc_results_period ON calculation_results(period_id);
CREATE INDEX idx_calc_results_employee ON calculation_results(employee_id);

CREATE TABLE approval_steps (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES calculation_periods(id),
  stage TEXT NOT NULL,
  work_unit_id TEXT REFERENCES work_units(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  acted_by_user_id TEXT REFERENCES users(id),
  acted_by_name TEXT,
  acted_at TEXT,
  note TEXT
);
CREATE INDEX idx_approval_steps_period ON approval_steps(period_id, stage);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  related_period_id TEXT REFERENCES calculation_periods(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
