export const WORK_UNIT_CATEGORIES = [
  { value: 'rawat_inap', label: 'Rawat Inap' },
  { value: 'rawat_jalan', label: 'Rawat Jalan' },
  { value: 'igd', label: 'IGD' },
  { value: 'rawat_intensif', label: 'Rawat Intensif / NICU / PICU' },
  { value: 'ibs', label: 'Instalasi Bedah Sentral (IBS)' },
  { value: 'radiologi', label: 'Radiologi' },
  { value: 'lab_patologi', label: 'Laboratorium Patologi Klinik' },
  { value: 'lab_khusus', label: 'Laboratorium Khusus' },
  { value: 'rehab_medik', label: 'Rehabilitasi Medik' },
  { value: 'luar_kamar_operasi', label: 'Tindakan di Luar Kamar Operasi' },
  { value: 'administrasi', label: 'Administrasi' },
  { value: 'struktural', label: 'Struktural / Manajemen' },
  { value: 'lainnya', label: 'Lainnya' }
] as const;

export const EMPLOYEE_CATEGORIES = [
  { value: 'medis', label: 'Tenaga Medis' },
  { value: 'keperawatan', label: 'Keperawatan' },
  { value: 'nakes_non_keperawatan', label: 'Nakes Non-Keperawatan' },
  { value: 'administrasi', label: 'Administrasi' },
  { value: 'struktural', label: 'Struktural' }
] as const;

export const EMPLOYMENT_STATUSES = [
  { value: 'pns', label: 'PNS' },
  { value: 'pppk', label: 'PPPK' },
  { value: 'non_asn', label: 'Non-ASN' }
] as const;

export const PAYMENT_TYPES = [
  { value: 'jkn', label: 'JKN' },
  { value: 'non_jkn', label: 'Non-JKN' }
] as const;

export const SERVICE_ROLES = [
  { value: 'operator', label: 'Operator' },
  { value: 'co_operator', label: 'Co-Operator' },
  { value: 'anestesi', label: 'Anestesi' },
  { value: 'dpjp', label: 'DPJP' },
  { value: 'pelaksana', label: 'Pelaksana' }
] as const;

export const IDENTITY_SOURCE_SYSTEMS = [
  { value: 'simrs', label: 'SIMRS' },
  { value: 'baraya', label: 'BARAYA' },
  { value: 'bpjs', label: 'Klaim BPJS' },
  { value: 'kinerja', label: 'Indeks/Skor Kinerja' }
] as const;

export const ATTENDANCE_RECORD_TYPES = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'cuti', label: 'Cuti' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'izin', label: 'Izin' },
  { value: 'diklat', label: 'Diklat' },
  { value: 'tugas_belajar', label: 'Tugas Belajar' },
  { value: 'pembinaan_disiplin', label: 'Pembinaan/Hukuman Disiplin' },
  { value: 'perkelahian', label: 'Terlibat Perkelahian' }
] as const;

export const BPJS_CLAIM_STATUSES = [
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'diverifikasi', label: 'Diverifikasi' },
  { value: 'dicairkan', label: 'Dicairkan' },
  { value: 'pending', label: 'Pending' },
  { value: 'ditolak', label: 'Ditolak' }
] as const;

export const PERFORMANCE_CATEGORIES = [
  { value: 'kpii_perawat', label: 'KPII Perawat' },
  { value: 'indeksing_administrasi', label: 'Indeksing Tenaga Administrasi' },
  { value: 'iki_job_grade', label: 'IKI Berbasis Job Grade' }
] as const;

export const PERIOD_STATUSES = [
  'draft',
  'importing',
  'ready_to_calculate',
  'calculated',
  'verifying_unit',
  'verifying_keuangan',
  'verifying_direktur',
  'approved',
  'published',
  'locked'
] as const;

export const PERIOD_STATUS_LABELS: Record<(typeof PERIOD_STATUSES)[number], string> = {
  draft: 'Draf',
  importing: 'Impor Data',
  ready_to_calculate: 'Siap Dikalkulasi',
  calculated: 'Sudah Dikalkulasi (Simulasi)',
  verifying_unit: 'Menunggu Verifikasi Unit',
  verifying_keuangan: 'Menunggu Verifikasi Keuangan',
  verifying_direktur: 'Menunggu Persetujuan Direktur',
  approved: 'Disetujui',
  published: 'Terpublikasi',
  locked: 'Terkunci'
};

export const IMPORT_SOURCES = [
  { value: 'simrs', label: 'SIMRS - Volume Pasien & Tindakan' },
  { value: 'bpjs', label: 'Klaim BPJS - Pengajuan & Pencairan' },
  { value: 'baraya_attendance', label: 'BARAYA - Absensi' },
  { value: 'baraya_biodata', label: 'BARAYA - Sinkronisasi Biodata' },
  { value: 'kinerja', label: 'Indeks/Skor Kinerja' }
] as const;

export const BPJS_PENDING_POLICIES = [
  { value: 'accrual', label: 'A - Basis Akrual (dihitung penuh)' },
  { value: 'cash', label: 'B - Basis Kas (hanya klaim cair)' },
  { value: 'hybrid', label: 'C - Hibrida (estimasi dengan cadangan)' }
] as const;
