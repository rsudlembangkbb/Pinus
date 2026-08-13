import type { RoleCode } from "./enums.js";

// Granular permission keys checked by the API's RBAC middleware. Grouped by
// module so new modules can extend this list without renumbering anything
// (permissions are strings, not ordinal codes).
export const PERMISSIONS = [
  // master data
  "master.employee.read",
  "master.employee.write",
  "master.work_unit.read",
  "master.work_unit.write",
  "master.proportion_scheme.read",
  "master.proportion_scheme.write",
  "master.job_grade.read",
  "master.job_grade.write",
  "master.deduction_rule.read",
  "master.deduction_rule.write",
  "master.tariff.read",
  "master.tariff.write",
  // import
  "import.upload",
  "import.commit",
  "import.read",
  // calculation
  "calculation.run",
  "calculation.simulate",
  "calculation.read",
  // workflow
  "workflow.manage_period",
  "workflow.verify_unit",
  "workflow.verify_keuangan",
  "workflow.approve_direktur",
  "workflow.lock",
  "workflow.correction",
  "workflow.read",
  // transparency (self-service)
  "self.dashboard.read",
  "self.slip.download",
  // management dashboard
  "dashboard.management.read",
  // reports/export
  "report.export",
  // users & RBAC
  "user.read",
  "user.write",
  "role.read",
  "role.write",
  // audit
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Default permission set per role. Stored in D1 (role_permissions table) at
// seed time and editable by SUPER_ADMIN afterwards -- this map is only the
// factory default, never consulted directly by the API at runtime.
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ADMIN_JASPEL: [
    "master.employee.read",
    "master.employee.write",
    "master.work_unit.read",
    "master.work_unit.write",
    "master.proportion_scheme.read",
    "master.proportion_scheme.write",
    "master.job_grade.read",
    "master.job_grade.write",
    "master.deduction_rule.read",
    "master.deduction_rule.write",
    "master.tariff.read",
    "master.tariff.write",
    "import.upload",
    "import.commit",
    "import.read",
    "calculation.run",
    "calculation.simulate",
    "calculation.read",
    "workflow.manage_period",
    "workflow.read",
    "workflow.correction",
    "report.export",
    "audit.read",
  ],
  VERIFIKATOR_UNIT: [
    "master.employee.read",
    "master.work_unit.read",
    "calculation.read",
    "workflow.verify_unit",
    "workflow.read",
    "report.export",
  ],
  KEUANGAN: [
    "master.employee.read",
    "master.work_unit.read",
    "calculation.read",
    "workflow.verify_keuangan",
    "workflow.read",
    "dashboard.management.read",
    "report.export",
  ],
  DIREKTUR: [
    "master.employee.read",
    "master.work_unit.read",
    "calculation.read",
    "workflow.approve_direktur",
    "workflow.read",
    "dashboard.management.read",
    "report.export",
    "audit.read",
  ],
  PEGAWAI: ["self.dashboard.read", "self.slip.download"],
  AUDITOR: [
    "master.employee.read",
    "master.work_unit.read",
    "master.proportion_scheme.read",
    "master.job_grade.read",
    "master.deduction_rule.read",
    "master.tariff.read",
    "import.read",
    "calculation.read",
    "workflow.read",
    "dashboard.management.read",
    "audit.read",
  ],
};
