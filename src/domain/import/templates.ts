import { ColumnSpec } from '@/lib/xlsx';

export const SIMRS_TEMPLATE_COLUMNS: ColumnSpec[] = [
  { header: 'Tanggal Layanan', key: 'serviceDate', example: '2026-08-05', required: true },
  { header: 'Kode Unit Kerja', key: 'workUnitCode', example: 'IGD', required: true },
  { header: 'Kode/No. RM Pasien', key: 'patientRefCode', example: 'RM-000123', required: false },
  { header: 'Jenis Layanan/Tindakan', key: 'serviceType', example: 'Konsultasi Dokter Umum', required: true },
  { header: 'Status Penjaminan (JKN/Non-JKN)', key: 'paymentType', example: 'JKN', required: true },
  { header: 'Nilai Tarif/Klaim (Rp)', key: 'tariffValue', example: 150000, required: true },
  { header: 'Kode Pegawai Pelaksana (SIMRS)', key: 'employeeCode', example: 'SIMRS-0456', required: true },
  { header: 'Peran (operator/co_operator/anestesi/dpjp/pelaksana)', key: 'role', example: 'dpjp', required: true },
  { header: 'Nomor Klaim BPJS (jika JKN)', key: 'bpjsClaimNumber', example: '', required: false }
];

export const BPJS_TEMPLATE_COLUMNS: ColumnSpec[] = [
  { header: 'Nomor Klaim', key: 'claimNumber', example: 'KLM-2026-000123', required: true },
  { header: 'Tanggal Pengajuan', key: 'submissionDate', example: '2026-08-03', required: false },
  { header: 'Kode Unit Kerja', key: 'workUnitCode', example: 'IGD', required: false },
  { header: 'Nilai Diajukan (Rp)', key: 'submittedValue', example: 150000, required: true },
  { header: 'Status Klaim (diajukan/diverifikasi/dicairkan/pending/ditolak)', key: 'status', example: 'diajukan', required: true },
  { header: 'Tanggal Realisasi', key: 'realizationDate', example: '', required: false },
  { header: 'Nilai Realisasi (Rp)', key: 'realizationValue', example: '', required: false }
];

export const BARAYA_ATTENDANCE_TEMPLATE_COLUMNS: ColumnSpec[] = [
  { header: 'Kode Pegawai (BARAYA)', key: 'employeeCode', example: 'BRY-0456', required: true },
  {
    header: 'Jenis Kehadiran (hadir/cuti/sakit/izin/diklat/tugas_belajar/pembinaan_disiplin/perkelahian)',
    key: 'recordType',
    example: 'cuti',
    required: true
  },
  { header: 'Jumlah Hari', key: 'daysCount', example: 3, required: true },
  { header: 'Keterangan', key: 'note', example: '', required: false }
];

export const BARAYA_BIODATA_TEMPLATE_COLUMNS: ColumnSpec[] = [
  { header: 'Kode Pegawai (BARAYA)', key: 'employeeCode', example: 'BRY-0456', required: true },
  { header: 'NIP', key: 'nip', example: '198501012010011001', required: false },
  { header: 'Nama Lengkap', key: 'name', example: 'dr. Contoh Nama', required: true },
  {
    header: 'Kategori Tenaga (medis/keperawatan/nakes_non_keperawatan/administrasi/struktural)',
    key: 'category',
    example: 'medis',
    required: false
  },
  { header: 'Kode Unit Kerja', key: 'workUnitCode', example: 'IGD', required: false },
  { header: 'Jabatan', key: 'position', example: 'Dokter Umum', required: false },
  { header: 'Status Kepegawaian (pns/pppk/non_asn)', key: 'employmentStatus', example: 'pns', required: false },
  { header: 'Status Aktif (ya/tidak)', key: 'isActive', example: 'ya', required: false }
];

export const PERFORMANCE_TEMPLATE_COLUMNS: ColumnSpec[] = [
  { header: 'Kode Pegawai', key: 'employeeCode', example: 'BRY-0456', required: true },
  {
    header: 'Kategori Penilaian (kpii_perawat/indeksing_administrasi/iki_job_grade)',
    key: 'category',
    example: 'indeksing_administrasi',
    required: true
  },
  { header: 'Skor Pengalaman', key: 'scorePengalaman', example: 80, required: false },
  { header: 'Skor Keterampilan', key: 'scoreKeterampilan', example: 85, required: false },
  { header: 'Skor Risiko Kerja', key: 'scoreRisikoKerja', example: 75, required: false },
  { header: 'Skor Kegawatdaruratan', key: 'scoreKegawatdaruratan', example: 70, required: false },
  { header: 'Skor Jabatan', key: 'scoreJabatan', example: 80, required: false },
  { header: 'Skor Capaian Kinerja', key: 'scoreCapaianKinerja', example: 90, required: false },
  { header: 'Skor Akhir', key: 'finalScore', example: 82.5, required: true },
  { header: 'Dinilai Oleh', key: 'assessedBy', example: 'Kepala Bagian', required: false },
  { header: 'Tanggal Penilaian', key: 'assessedAt', example: '2026-08-28', required: false }
];
