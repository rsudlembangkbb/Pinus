/**
 * Pure row-level validators for each import source. Operate on already
 * parsed spreadsheet rows (plain string/number values keyed by header) plus
 * pre-fetched lookup maps (identity mappings, work unit codes) - no direct
 * DB/HTTP access, so these are easy to unit test in isolation.
 */

export interface RowError {
  rowNumber: number;
  column?: string;
  message: string;
}

export interface Lookups {
  /** externalCode (for a specific source system) -> internal employee id */
  employeeBySourceCode: Map<string, string>;
  /** work unit code -> internal work unit id */
  workUnitByCode: Map<string, string>;
}

function cell(row: Record<string, unknown>, header: string): string {
  const v = row[header];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.-]/g, '');
  if (cleaned === '') return null;
  const value = Math.round(Number(cleaned));
  return Number.isFinite(value) ? value : null;
}

function parseDateStrict(raw: string): string | null {
  if (!raw) return null;
  // Accept YYYY-MM-DD directly; also accept Excel-serial numeric dates.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 20000 && asNumber < 90000) {
    // Excel serial date (days since 1899-12-30)
    const ms = (asNumber - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export interface ValidatedSimrsRow {
  serviceDate: string;
  workUnitId: string;
  patientRefCode: string | null;
  serviceType: string;
  paymentType: 'jkn' | 'non_jkn';
  tariffValue: number;
  employeeId: string | null;
  externalEmployeeCode: string;
  role: string;
  bpjsClaimNumber: string | null;
}

const ROLE_VALUES = new Set(['operator', 'co_operator', 'anestesi', 'dpjp', 'pelaksana']);

export function validateSimrsRow(
  row: Record<string, unknown>,
  rowNumber: number,
  lookups: Lookups
): { data: ValidatedSimrsRow } | { error: RowError } {
  const serviceDateRaw = cell(row, 'Tanggal Layanan');
  const workUnitCode = cell(row, 'Kode Unit Kerja');
  const serviceType = cell(row, 'Jenis Layanan/Tindakan');
  const paymentTypeRaw = cell(row, 'Status Penjaminan (JKN/Non-JKN)').toLowerCase();
  const tariffRaw = cell(row, 'Nilai Tarif/Klaim (Rp)');
  const employeeCode = cell(row, 'Kode Pegawai Pelaksana (SIMRS)');
  const roleRaw = cell(row, 'Peran (operator/co_operator/anestesi/dpjp/pelaksana)').toLowerCase();
  const bpjsClaimNumber = cell(row, 'Nomor Klaim BPJS (jika JKN)');

  const serviceDate = parseDateStrict(serviceDateRaw);
  if (!serviceDate) return { error: { rowNumber, column: 'Tanggal Layanan', message: 'Tanggal layanan tidak valid.' } };

  const workUnitId = lookups.workUnitByCode.get(workUnitCode.toUpperCase());
  if (!workUnitId) return { error: { rowNumber, column: 'Kode Unit Kerja', message: `Kode unit kerja "${workUnitCode}" tidak dikenali.` } };

  if (!serviceType) return { error: { rowNumber, column: 'Jenis Layanan/Tindakan', message: 'Jenis layanan wajib diisi.' } };

  const paymentType = paymentTypeRaw === 'jkn' ? 'jkn' : paymentTypeRaw === 'non-jkn' || paymentTypeRaw === 'non_jkn' ? 'non_jkn' : null;
  if (!paymentType) return { error: { rowNumber, column: 'Status Penjaminan', message: 'Status penjaminan harus JKN atau Non-JKN.' } };

  const tariffValue = parseMoney(tariffRaw);
  if (tariffValue === null || tariffValue < 0) return { error: { rowNumber, column: 'Nilai Tarif/Klaim', message: 'Nilai tarif tidak valid.' } };

  if (!employeeCode) return { error: { rowNumber, column: 'Kode Pegawai Pelaksana', message: 'Kode pegawai pelaksana wajib diisi.' } };

  if (!ROLE_VALUES.has(roleRaw)) {
    return { error: { rowNumber, column: 'Peran', message: `Peran "${roleRaw}" tidak dikenali.` } };
  }

  const employeeId = lookups.employeeBySourceCode.get(employeeCode) ?? null;

  return {
    data: {
      serviceDate,
      workUnitId,
      patientRefCode: cell(row, 'Kode/No. RM Pasien') || null,
      serviceType,
      paymentType,
      tariffValue,
      employeeId,
      externalEmployeeCode: employeeCode,
      role: roleRaw,
      bpjsClaimNumber: bpjsClaimNumber || null
    }
  };
}

export interface ValidatedBpjsRow {
  claimNumber: string;
  submissionDate: string | null;
  workUnitId: string | null;
  submittedValue: number;
  status: string;
  realizationDate: string | null;
  realizationValue: number | null;
}

const BPJS_STATUS_VALUES = new Set(['diajukan', 'diverifikasi', 'dicairkan', 'pending', 'ditolak']);

export function validateBpjsRow(
  row: Record<string, unknown>,
  rowNumber: number,
  lookups: Lookups
): { data: ValidatedBpjsRow } | { error: RowError } {
  const claimNumber = cell(row, 'Nomor Klaim');
  if (!claimNumber) return { error: { rowNumber, column: 'Nomor Klaim', message: 'Nomor klaim wajib diisi.' } };

  const submittedRaw = cell(row, 'Nilai Diajukan (Rp)');
  const submittedValue = parseMoney(submittedRaw);
  if (submittedValue === null || submittedValue < 0)
    return { error: { rowNumber, column: 'Nilai Diajukan', message: 'Nilai diajukan tidak valid.' } };

  const statusRaw = cell(row, 'Status Klaim (diajukan/diverifikasi/dicairkan/pending/ditolak)').toLowerCase();
  if (!BPJS_STATUS_VALUES.has(statusRaw)) {
    return { error: { rowNumber, column: 'Status Klaim', message: `Status klaim "${statusRaw}" tidak dikenali.` } };
  }

  const workUnitCode = cell(row, 'Kode Unit Kerja');
  const workUnitId = workUnitCode ? lookups.workUnitByCode.get(workUnitCode.toUpperCase()) ?? null : null;

  const realizationValueRaw = cell(row, 'Nilai Realisasi (Rp)');
  const realizationValue = realizationValueRaw ? parseMoney(realizationValueRaw) : null;

  return {
    data: {
      claimNumber,
      submissionDate: parseDateStrict(cell(row, 'Tanggal Pengajuan')),
      workUnitId,
      submittedValue,
      status: statusRaw,
      realizationDate: parseDateStrict(cell(row, 'Tanggal Realisasi')),
      realizationValue
    }
  };
}

export interface ValidatedAttendanceRow {
  employeeId: string | null;
  externalEmployeeCode: string;
  recordType: string;
  daysCount: number; // scaled x100
  note: string | null;
}

const ATTENDANCE_TYPES = new Set([
  'hadir',
  'cuti',
  'sakit',
  'izin',
  'diklat',
  'tugas_belajar',
  'pembinaan_disiplin',
  'perkelahian'
]);

export function validateAttendanceRow(
  row: Record<string, unknown>,
  rowNumber: number,
  lookups: Lookups
): { data: ValidatedAttendanceRow } | { error: RowError } {
  const employeeCode = cell(row, 'Kode Pegawai (BARAYA)');
  if (!employeeCode) return { error: { rowNumber, column: 'Kode Pegawai', message: 'Kode pegawai wajib diisi.' } };

  const recordType = cell(
    row,
    'Jenis Kehadiran (hadir/cuti/sakit/izin/diklat/tugas_belajar/pembinaan_disiplin/perkelahian)'
  ).toLowerCase();
  if (!ATTENDANCE_TYPES.has(recordType)) {
    return { error: { rowNumber, column: 'Jenis Kehadiran', message: `Jenis kehadiran "${recordType}" tidak dikenali.` } };
  }

  const daysRaw = cell(row, 'Jumlah Hari');
  const days = Number(daysRaw);
  if (!Number.isFinite(days) || days < 0) return { error: { rowNumber, column: 'Jumlah Hari', message: 'Jumlah hari tidak valid.' } };

  return {
    data: {
      employeeId: lookups.employeeBySourceCode.get(employeeCode) ?? null,
      externalEmployeeCode: employeeCode,
      recordType,
      daysCount: Math.round(days * 100),
      note: cell(row, 'Keterangan') || null
    }
  };
}

export interface ValidatedPerformanceRow {
  employeeId: string | null;
  externalEmployeeCode: string;
  category: string;
  componentScores: Record<string, number>;
  finalScore: number; // scaled x100
  assessedBy: string | null;
  assessedAt: string | null;
}

const PERFORMANCE_CATEGORIES = new Set(['kpii_perawat', 'indeksing_administrasi', 'iki_job_grade']);

export function validatePerformanceRow(
  row: Record<string, unknown>,
  rowNumber: number,
  lookups: Lookups
): { data: ValidatedPerformanceRow } | { error: RowError } {
  const employeeCode = cell(row, 'Kode Pegawai');
  if (!employeeCode) return { error: { rowNumber, column: 'Kode Pegawai', message: 'Kode pegawai wajib diisi.' } };

  const category = cell(row, 'Kategori Penilaian (kpii_perawat/indeksing_administrasi/iki_job_grade)').toLowerCase();
  if (!PERFORMANCE_CATEGORIES.has(category)) {
    return { error: { rowNumber, column: 'Kategori Penilaian', message: `Kategori "${category}" tidak dikenali.` } };
  }

  const finalScoreRaw = cell(row, 'Skor Akhir');
  const finalScore = Number(finalScoreRaw);
  if (!Number.isFinite(finalScore) || finalScore < 0) {
    return { error: { rowNumber, column: 'Skor Akhir', message: 'Skor akhir tidak valid.' } };
  }

  const componentScores: Record<string, number> = {};
  for (const [label, key] of [
    ['Skor Pengalaman', 'pengalaman'],
    ['Skor Keterampilan', 'keterampilan'],
    ['Skor Risiko Kerja', 'risiko_kerja'],
    ['Skor Kegawatdaruratan', 'kegawatdaruratan'],
    ['Skor Jabatan', 'jabatan'],
    ['Skor Capaian Kinerja', 'capaian_kinerja']
  ] as const) {
    const raw = cell(row, label);
    if (raw !== '') {
      const num = Number(raw);
      if (Number.isFinite(num)) componentScores[key] = num;
    }
  }

  return {
    data: {
      employeeId: lookups.employeeBySourceCode.get(employeeCode) ?? null,
      externalEmployeeCode: employeeCode,
      category,
      componentScores,
      finalScore: Math.round(finalScore * 100),
      assessedBy: cell(row, 'Dinilai Oleh') || null,
      assessedAt: parseDateStrict(cell(row, 'Tanggal Penilaian'))
    }
  };
}

export interface ValidatedBiodataRow {
  employeeCode: string;
  nip: string | null;
  name: string;
  category: string | null;
  workUnitId: string | null;
  position: string | null;
  employmentStatus: 'pns' | 'pppk' | 'non_asn' | null;
  isActive: boolean | null;
}

const EMPLOYEE_CATEGORY_VALUES = new Set(['medis', 'keperawatan', 'nakes_non_keperawatan', 'administrasi', 'struktural']);

export function validateBiodataRow(
  row: Record<string, unknown>,
  rowNumber: number,
  lookups: Lookups
): { data: ValidatedBiodataRow } | { error: RowError } {
  const employeeCode = cell(row, 'Kode Pegawai (BARAYA)');
  if (!employeeCode) return { error: { rowNumber, column: 'Kode Pegawai', message: 'Kode pegawai wajib diisi.' } };

  const name = cell(row, 'Nama Lengkap');
  if (!name) return { error: { rowNumber, column: 'Nama Lengkap', message: 'Nama lengkap wajib diisi.' } };

  const workUnitCode = cell(row, 'Kode Unit Kerja');
  const workUnitId = workUnitCode ? lookups.workUnitByCode.get(workUnitCode.toUpperCase()) ?? null : null;

  const employmentStatusRaw = cell(row, 'Status Kepegawaian (pns/pppk/non_asn)').toLowerCase();
  const employmentStatus = ['pns', 'pppk', 'non_asn'].includes(employmentStatusRaw)
    ? (employmentStatusRaw as 'pns' | 'pppk' | 'non_asn')
    : null;

  const activeRaw = cell(row, 'Status Aktif (ya/tidak)').toLowerCase();
  const isActive = activeRaw === '' ? null : activeRaw === 'ya' || activeRaw === 'aktif' || activeRaw === '1' || activeRaw === 'true';

  const categoryRaw = cell(
    row,
    'Kategori Tenaga (medis/keperawatan/nakes_non_keperawatan/administrasi/struktural)'
  ).toLowerCase();
  const category = EMPLOYEE_CATEGORY_VALUES.has(categoryRaw) ? categoryRaw : null;

  return {
    data: {
      employeeCode,
      nip: cell(row, 'NIP') || null,
      name,
      category,
      workUnitId,
      position: cell(row, 'Jabatan') || null,
      employmentStatus,
      isActive
    }
  };
}
