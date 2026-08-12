export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  data?: T;
}

export interface MasterDataLookups {
  workUnitByCode: Map<string, { id: string; isActive: boolean }>;
  employeeByNip: Map<string, { id: string; isActive: boolean; staffCategory: string }>;
}

const GUARANTEE_STATUS_MAP: Record<string, string> = {
  jkn: "JKN",
  "non-jkn": "NON_JKN",
  "non jkn": "NON_JKN",
  "non_jkn": "NON_JKN",
  nonjkn: "NON_JKN",
};

const SERVICE_ROLE_MAP: Record<string, string> = {
  dpjp: "DPJP",
  operator: "OPERATOR",
  "co-operator": "CO_OPERATOR",
  "co operator": "CO_OPERATOR",
  cooperator: "CO_OPERATOR",
  anestesi: "ANESTESI",
  pelaksana: "PELAKSANA",
};

function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "ya" || v === "yes" || v === "true" || v === "1";
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface ServiceTransactionRow {
  serviceDate: Date;
  workUnitId: string;
  patientRmCode: string;
  serviceName: string;
  guaranteeStatus: "JKN" | "NON_JKN";
  tariffAmount: number;
  employeeId: string;
  serviceRole: "DPJP" | "OPERATOR" | "CO_OPERATOR" | "ANESTESI" | "PELAKSANA";
}

export function validateServiceTransactionRow(
  raw: Record<string, string>,
  lookups: MasterDataLookups,
  periodYear: number,
  periodMonth: number,
): ValidationResult<ServiceTransactionRow> {
  const errors: string[] = [];

  const serviceDate = raw.serviceDate ? new Date(raw.serviceDate) : null;
  if (!serviceDate || Number.isNaN(serviceDate.getTime())) {
    errors.push("Tanggal Layanan tidak valid");
  } else if (serviceDate.getFullYear() !== periodYear || serviceDate.getMonth() + 1 !== periodMonth) {
    errors.push("Tanggal Layanan berada di luar periode yang dipilih");
  }

  const workUnit = raw.workUnitCode ? lookups.workUnitByCode.get(raw.workUnitCode.trim().toUpperCase()) : undefined;
  if (!workUnit) errors.push(`Kode Unit Kerja "${raw.workUnitCode}" tidak ditemukan pada master data`);
  else if (!workUnit.isActive) errors.push(`Unit Kerja "${raw.workUnitCode}" tidak aktif`);

  if (!raw.patientRmCode) errors.push("Kode/No. RM Pasien wajib diisi");
  if (!raw.serviceName) errors.push("Jenis Layanan/Tindakan wajib diisi");

  const guaranteeStatus = GUARANTEE_STATUS_MAP[raw.guaranteeStatus?.trim().toLowerCase()];
  if (!guaranteeStatus) errors.push(`Status Penjaminan "${raw.guaranteeStatus}" harus JKN atau NON_JKN`);

  const tariffAmount = parseNumber(raw.tariffAmount ?? "");
  if (tariffAmount === null || tariffAmount < 0) errors.push("Nilai Tarif/Klaim harus berupa angka >= 0");

  const employee = raw.employeeNip ? lookups.employeeByNip.get(raw.employeeNip.trim()) : undefined;
  if (!employee) errors.push(`NIP Pegawai "${raw.employeeNip}" tidak ditemukan pada master data`);
  else if (!employee.isActive) errors.push(`Pegawai dengan NIP "${raw.employeeNip}" tidak aktif`);

  const serviceRole = SERVICE_ROLE_MAP[raw.serviceRole?.trim().toLowerCase()];
  if (!serviceRole) errors.push(`Peran "${raw.serviceRole}" tidak valid`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: {
      serviceDate: serviceDate!,
      workUnitId: workUnit!.id,
      patientRmCode: raw.patientRmCode.trim(),
      serviceName: raw.serviceName.trim(),
      guaranteeStatus: guaranteeStatus as "JKN" | "NON_JKN",
      tariffAmount: tariffAmount!,
      employeeId: employee!.id,
      serviceRole: serviceRole as ServiceTransactionRow["serviceRole"],
    },
  };
}

export interface AttendanceRow {
  employeeId: string;
  leaveDays: number;
  leaveType: string | null;
  disciplinaryAction: boolean;
  disciplinaryNotes: string | null;
  fightDuringCoaching: boolean;
  trainingDays: number;
  studyAssignmentAbsenceDaysPerWeek: number;
  attendancePercent: number;
}

export function validateAttendanceRow(
  raw: Record<string, string>,
  lookups: MasterDataLookups,
): ValidationResult<AttendanceRow> {
  const errors: string[] = [];

  const employee = raw.employeeNip ? lookups.employeeByNip.get(raw.employeeNip.trim()) : undefined;
  if (!employee) errors.push(`NIP Pegawai "${raw.employeeNip}" tidak ditemukan pada master data`);

  const leaveDays = raw.leaveDays ? parseNumber(raw.leaveDays) : 0;
  if (leaveDays === null || leaveDays < 0) errors.push("Jumlah Hari Cuti harus berupa angka >= 0");

  const trainingDays = raw.trainingDays ? parseNumber(raw.trainingDays) : 0;
  if (trainingDays === null || trainingDays < 0) errors.push("Jumlah Hari Diklat harus berupa angka >= 0");

  const studyAbsence = raw.studyAssignmentAbsenceDaysPerWeek ? parseNumber(raw.studyAssignmentAbsenceDaysPerWeek) : 0;
  if (studyAbsence === null || studyAbsence < 0) errors.push("Hari Absen Tugas Belajar harus berupa angka >= 0");

  const attendancePercent = parseNumber(raw.attendancePercent ?? "");
  if (attendancePercent === null || attendancePercent < 0 || attendancePercent > 100) {
    errors.push("Persentase Kehadiran harus berupa angka antara 0-100");
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: {
      employeeId: employee!.id,
      leaveDays: leaveDays!,
      leaveType: raw.leaveType || null,
      disciplinaryAction: parseBoolean(raw.disciplinaryAction ?? ""),
      disciplinaryNotes: raw.disciplinaryNotes || null,
      fightDuringCoaching: parseBoolean(raw.fightDuringCoaching ?? ""),
      trainingDays: trainingDays!,
      studyAssignmentAbsenceDaysPerWeek: studyAbsence!,
      attendancePercent: attendancePercent!,
    },
  };
}

export interface PerformanceScoreRow {
  employeeId: string;
  qualityScore: number;
  notes: string | null;
}

export function validatePerformanceScoreRow(
  raw: Record<string, string>,
  lookups: MasterDataLookups,
): ValidationResult<PerformanceScoreRow> {
  const errors: string[] = [];

  const employee = raw.employeeNip ? lookups.employeeByNip.get(raw.employeeNip.trim()) : undefined;
  if (!employee) errors.push(`NIP Pegawai "${raw.employeeNip}" tidak ditemukan pada master data`);

  const qualityScore = parseNumber(raw.qualityScore ?? "");
  if (qualityScore === null || qualityScore < 0 || qualityScore > 100) {
    errors.push("Skor Kualitas harus berupa angka antara 0-100");
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: { employeeId: employee!.id, qualityScore: qualityScore!, notes: raw.notes || null },
  };
}

const INDEXING_VARIABLES = new Set(["EXPERIENCE", "SKILL", "RISK", "URGENCY", "POSITION"]);

export interface IndexingScoreRow {
  employeeId: string;
  variableCode: string;
  score: number;
}

export function validateIndexingScoreRow(
  raw: Record<string, string>,
  lookups: MasterDataLookups,
): ValidationResult<IndexingScoreRow> {
  const errors: string[] = [];

  const employee = raw.employeeNip ? lookups.employeeByNip.get(raw.employeeNip.trim()) : undefined;
  if (!employee) errors.push(`NIP Pegawai "${raw.employeeNip}" tidak ditemukan pada master data`);

  const variableCode = raw.variableCode?.trim().toUpperCase();
  if (!variableCode || !INDEXING_VARIABLES.has(variableCode)) {
    errors.push(`Variabel "${raw.variableCode}" tidak valid`);
  }

  const score = parseNumber(raw.score ?? "");
  if (score === null || score < 0 || score > 100) errors.push("Skor harus berupa angka antara 0-100");

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: { employeeId: employee!.id, variableCode: variableCode!, score: score! },
  };
}
