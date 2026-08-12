/**
 * Shared enums mirrored from apps/api/prisma/schema.prisma.
 * Keep in sync manually — Prisma generates its own enum types for the API,
 * this copy is what the frontend (which has no Prisma client) imports.
 */

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN_JASPEL = "ADMIN_JASPEL",
  VERIFIKATOR_UNIT = "VERIFIKATOR_UNIT",
  KEUANGAN = "KEUANGAN",
  DIREKTUR = "DIREKTUR",
  PEGAWAI = "PEGAWAI",
  AUDITOR = "AUDITOR",
}

export enum StaffCategory {
  MEDIS = "MEDIS",
  KEPERAWATAN = "KEPERAWATAN",
  NAKES_LAIN = "NAKES_LAIN",
  ADMINISTRASI = "ADMINISTRASI",
  STRUKTURAL = "STRUKTURAL",
}

export enum EmploymentStatus {
  PNS = "PNS",
  PPPK = "PPPK",
  NON_ASN = "NON_ASN",
}

export enum ServiceGuaranteeStatus {
  JKN = "JKN",
  NON_JKN = "NON_JKN",
}

export enum ServiceRole {
  DPJP = "DPJP",
  OPERATOR = "OPERATOR",
  CO_OPERATOR = "CO_OPERATOR",
  ANESTESI = "ANESTESI",
  PELAKSANA = "PELAKSANA",
}

export enum ImportBatchType {
  SERVICE_TRANSACTION = "SERVICE_TRANSACTION",
  ATTENDANCE = "ATTENDANCE",
  PERFORMANCE_SCORE = "PERFORMANCE_SCORE",
  INDEXING_SCORE = "INDEXING_SCORE",
}

export enum ImportBatchStatus {
  UPLOADED = "UPLOADED",
  VALIDATING = "VALIDATING",
  VALIDATED = "VALIDATED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  COMMITTED = "COMMITTED",
}

export enum ImportRowStatus {
  PENDING = "PENDING",
  VALID = "VALID",
  INVALID = "INVALID",
  COMMITTED = "COMMITTED",
}

export enum PeriodStatus {
  DRAFT = "DRAFT",
  PROCESSING = "PROCESSING",
  CALCULATED = "CALCULATED",
  UNIT_VERIFICATION = "UNIT_VERIFICATION",
  FINANCE_VERIFICATION = "FINANCE_VERIFICATION",
  DIRECTOR_APPROVAL = "DIRECTOR_APPROVAL",
  FINAL = "FINAL",
  PUBLISHED = "PUBLISHED",
}

export enum ApprovalStage {
  UNIT_VERIFICATION = "UNIT_VERIFICATION",
  FINANCE_VERIFICATION = "FINANCE_VERIFICATION",
  DIRECTOR_APPROVAL = "DIRECTOR_APPROVAL",
}

export enum ApprovalDecision {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum DeductionTrigger {
  DISCIPLINARY_ACTION = "DISCIPLINARY_ACTION",
  LEAVE_GE_1_MONTH = "LEAVE_GE_1_MONTH",
  FIGHT_DURING_COACHING = "FIGHT_DURING_COACHING",
  TRAINING_GT_1_MONTH = "TRAINING_GT_1_MONTH",
  STUDY_ASSIGNMENT_ABSENCE = "STUDY_ASSIGNMENT_ABSENCE",
}

export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
}

export enum MinimumRequirementLevel {
  DOKTER_SUBSPESIALIS = "DOKTER_SUBSPESIALIS",
  DOKTER_SPESIALIS = "DOKTER_SPESIALIS",
  DOKTER_UMUM = "DOKTER_UMUM",
  PERAWAT_MAHIR = "PERAWAT_MAHIR",
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Admin / IT Administrator",
  [UserRole.ADMIN_JASPEL]: "Admin Jaspel / Tim Remunerasi",
  [UserRole.VERIFIKATOR_UNIT]: "Verifikator Unit / Kepala Instalasi",
  [UserRole.KEUANGAN]: "Bagian Keuangan / Pejabat Keuangan BLUD",
  [UserRole.DIREKTUR]: "Direktur / Pejabat Pengelola BLUD",
  [UserRole.PEGAWAI]: "Pegawai",
  [UserRole.AUDITOR]: "Auditor / Inspektorat",
};

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  [PeriodStatus.DRAFT]: "Draft",
  [PeriodStatus.PROCESSING]: "Diproses",
  [PeriodStatus.CALCULATED]: "Terkalkulasi",
  [PeriodStatus.UNIT_VERIFICATION]: "Menunggu Verifikasi Unit",
  [PeriodStatus.FINANCE_VERIFICATION]: "Menunggu Verifikasi Keuangan",
  [PeriodStatus.DIRECTOR_APPROVAL]: "Menunggu Persetujuan Direktur",
  [PeriodStatus.FINAL]: "Final",
  [PeriodStatus.PUBLISHED]: "Terpublikasi",
};
