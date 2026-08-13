PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  employee_id TEXT,
  work_unit_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_grades (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  distribution_weight REAL NOT NULL DEFAULT 1,
  experience_weight REAL NOT NULL DEFAULT 1,
  skill_weight REAL NOT NULL DEFAULT 1,
  risk_weight REAL NOT NULL DEFAULT 1,
  emergency_weight REAL NOT NULL DEFAULT 1,
  performance_weight REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  category TEXT NOT NULL,
  profession TEXT NOT NULL,
  work_unit_id TEXT NOT NULL,
  position_title TEXT NOT NULL,
  job_grade_code TEXT,
  employment_status TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  started_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(work_unit_id) REFERENCES work_units(id),
  FOREIGN KEY(job_grade_code) REFERENCES job_grades(code)
);

CREATE TABLE IF NOT EXISTS proportion_schemes (
  id TEXT PRIMARY KEY,
  work_unit_id TEXT,
  employee_category TEXT NOT NULL,
  payer_type TEXT,
  role_in_service TEXT,
  percentage REAL NOT NULL DEFAULT 0,
  fixed_share_percentage REAL NOT NULL DEFAULT 0,
  subsidy_share_percentage REAL NOT NULL DEFAULT 0,
  effective_start_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(work_unit_id) REFERENCES work_units(id)
);

CREATE TABLE IF NOT EXISTS deduction_rules (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  percentage REAL NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calculation_periods (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  budget_medical REAL NOT NULL DEFAULT 0,
  budget_health REAL NOT NULL DEFAULT 0,
  budget_admin REAL NOT NULL DEFAULT 0,
  minimum_specialist REAL NOT NULL DEFAULT 0,
  minimum_general_practitioner REAL NOT NULL DEFAULT 0,
  minimum_senior_nurse REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT NOT NULL DEFAULT '[]',
  raw_payload_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(period_id) REFERENCES calculation_periods(id),
  FOREIGN KEY(uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS service_transactions (
  id TEXT PRIMARY KEY,
  import_batch_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  service_date TEXT NOT NULL,
  work_unit_id TEXT NOT NULL,
  patient_reference TEXT NOT NULL,
  service_name TEXT NOT NULL,
  payer_type TEXT NOT NULL,
  tariff_amount REAL NOT NULL,
  performer_employee_id TEXT NOT NULL,
  role_in_service TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(import_batch_id) REFERENCES import_batches(id),
  FOREIGN KEY(period_id) REFERENCES calculation_periods(id),
  FOREIGN KEY(work_unit_id) REFERENCES work_units(id),
  FOREIGN KEY(performer_employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  attendance_rate REAL NOT NULL DEFAULT 1,
  quality_score REAL NOT NULL DEFAULT 1,
  workload_factor REAL NOT NULL DEFAULT 1,
  deduction_percentage REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, employee_id),
  FOREIGN KEY(period_id) REFERENCES calculation_periods(id),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS performance_scores (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 1,
  assessor_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, employee_id),
  FOREIGN KEY(period_id) REFERENCES calculation_periods(id),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS calculation_results (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  gross_amount REAL NOT NULL DEFAULT 0,
  deduction_amount REAL NOT NULL DEFAULT 0,
  adjustment_amount REAL NOT NULL DEFAULT 0,
  final_amount REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, employee_id),
  FOREIGN KEY(period_id) REFERENCES calculation_periods(id),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  role_required TEXT NOT NULL,
  work_unit_id TEXT,
  actor_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  acted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(period_id) REFERENCES calculation_periods(id),
  FOREIGN KEY(work_unit_id) REFERENCES work_units(id),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_employees_work_unit_id ON employees(work_unit_id);
CREATE INDEX IF NOT EXISTS idx_transactions_period_id ON service_transactions(period_id);
CREATE INDEX IF NOT EXISTS idx_results_period_id ON calculation_results(period_id);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_logs(occurred_at DESC);
