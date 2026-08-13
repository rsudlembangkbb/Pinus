// Domain enums shared between API and web. Kept as string unions + const
// arrays (not TS enums) so they serialize cleanly over JSON and stay
// trivially comparable with SQLite TEXT columns.

export const ROLE_CODES = [
  "SUPER_ADMIN",
  "ADMIN_JASPEL",
  "VERIFIKATOR_UNIT",
  "KEUANGAN",
  "DIREKTUR",
  "PEGAWAI",
  "AUDITOR",
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: "Super Admin / IT Administrator",
  ADMIN_JASPEL: "Admin Jaspel / Tim Remunerasi",
  VERIFIKATOR_UNIT: "Verifikator Unit / Kepala Instalasi",
  KEUANGAN: "Bagian Keuangan / Pejabat Keuangan BLUD",
  DIREKTUR: "Direktur / Pejabat Pengelola BLUD",
  PEGAWAI: "Pegawai",
  AUDITOR: "Auditor / Inspektorat",
};

// "Unit Layanan" categories from Kepdirjen Yankes table 9 & 10 -- the axis
// proportion_schemes are keyed on. A work_unit maps to exactly one of these;
// IBS additionally splits by ServiceRole at calculation time.
export const SERVICE_CATEGORIES = [
  "RAWAT_INAP",
  "RAWAT_JALAN",
  "RAWAT_INTENSIF",
  "IGD",
  "IBS",
  "RADIOLOGI",
  "LABORATORIUM_PATOLOGI_KLINIK",
  "LABORATORIUM_KHUSUS",
  "REHABILITASI_MEDIK",
  "TINDAKAN_LUAR_KAMAR_OPERASI",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  RAWAT_INAP: "Rawat Inap",
  RAWAT_JALAN: "Rawat Jalan",
  RAWAT_INTENSIF: "Rawat Intensif / NICU / PICU",
  IGD: "IGD",
  IBS: "Instalasi Bedah Sentral (IBS)",
  RADIOLOGI: "Radiologi",
  LABORATORIUM_PATOLOGI_KLINIK: "Laboratorium Patologi Klinik",
  LABORATORIUM_KHUSUS: "Laboratorium Khusus",
  REHABILITASI_MEDIK: "Rehabilitasi Medik",
  TINDAKAN_LUAR_KAMAR_OPERASI: "Tindakan di Luar Kamar Operasi",
};

// Indexing variables for tenaga administrasi/struktural (PRD 9.3).
export const INDEXING_VARIABLES = [
  "PENGALAMAN_MASA_KERJA",
  "KETERAMPILAN",
  "RISIKO_KERJA",
  "KEGAWATDARURATAN",
  "JABATAN",
  "CAPAIAN_KINERJA",
] as const;
export type IndexingVariable = (typeof INDEXING_VARIABLES)[number];

export const INDEXING_VARIABLE_LABELS: Record<IndexingVariable, string> = {
  PENGALAMAN_MASA_KERJA: "Pengalaman & Masa Kerja",
  KETERAMPILAN: "Keterampilan / Ilmu Pengetahuan / Perilaku",
  RISIKO_KERJA: "Risiko Kerja",
  KEGAWATDARURATAN: "Tingkat Kegawatdaruratan",
  JABATAN: "Jabatan yang Disandang",
  CAPAIAN_KINERJA: "Capaian Kinerja (Kehadiran 40% + Kualitas 60%)",
};

export const EMPLOYEE_CATEGORIES = [
  "MEDIS",
  "KEPERAWATAN",
  "NAKES_LAIN",
  "ADMINISTRASI",
  "STRUKTURAL",
] as const;
export type EmployeeCategory = (typeof EMPLOYEE_CATEGORIES)[number];

export const EMPLOYMENT_STATUSES = ["PNS", "PPPK", "NON_ASN"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const PENJAMINAN_STATUSES = ["JKN", "NON_JKN"] as const;
export type PenjaminanStatus = (typeof PENJAMINAN_STATUSES)[number];

// Role played by an employee within a single service transaction line.
export const SERVICE_ROLES = [
  "DPJP",
  "OPERATOR",
  "CO_OPERATOR",
  "ANESTESI",
  "PERAWAT_PELAKSANA",
  "PELAKSANA_LAIN",
] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];

export const CALCULATION_ENGINE_KINDS = [
  "MEDIS",
  "TIM_UNIT",
  "INDEKSING",
] as const;
export type CalculationEngineKind = (typeof CALCULATION_ENGINE_KINDS)[number];

export const PERIOD_STATUSES = [
  "DRAFT",
  "DIPROSES",
  "MENUNGGU_VERIFIKASI_UNIT",
  "MENUNGGU_VERIFIKASI_KEUANGAN",
  "MENUNGGU_PERSETUJUAN_DIREKTUR",
  "FINAL",
  "DIBATALKAN",
] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  DRAFT: "Draft",
  DIPROSES: "Diproses",
  MENUNGGU_VERIFIKASI_UNIT: "Menunggu Verifikasi Unit",
  MENUNGGU_VERIFIKASI_KEUANGAN: "Menunggu Verifikasi Keuangan",
  MENUNGGU_PERSETUJUAN_DIREKTUR: "Menunggu Persetujuan Direktur",
  FINAL: "Final / Terpublikasi",
  DIBATALKAN: "Dibatalkan",
};

export const APPROVAL_STAGES = [
  "VERIFIKASI_UNIT",
  "VERIFIKASI_KEUANGAN",
  "PERSETUJUAN_DIREKTUR",
] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const IMPORT_BATCH_KINDS = [
  "SERVICE_TRANSACTIONS",
  "ATTENDANCE",
  "PERFORMANCE_SCORES",
] as const;
export type ImportBatchKind = (typeof IMPORT_BATCH_KINDS)[number];

export const IMPORT_BATCH_STATUSES = [
  "UPLOADED",
  "VALIDATED",
  "COMMITTED",
  "FAILED",
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_ROW_STATUSES = ["OK", "WARNING", "ERROR"] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const DEDUCTION_RULE_CODES = [
  "PEMBINAAN_DISIPLIN",
  "CUTI_GE_1_BULAN",
  "PERKELAHIAN",
  "DIKLAT_GT_1_BULAN",
  "TUGAS_BELAJAR",
] as const;
export type DeductionRuleCode = (typeof DEDUCTION_RULE_CODES)[number];

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "LOCK",
  "UNLOCK",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "EXPORT",
  "IMPORT_COMMIT",
  "CALCULATE",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const NOTIFICATION_KINDS = [
  "PERIOD_STATUS_CHANGE",
  "APPROVAL_REQUIRED",
  "REJECTED",
  "PUBLISHED",
  "IMPORT_RESULT",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
