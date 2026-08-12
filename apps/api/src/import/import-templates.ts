/**
 * Column definitions for each importable file type (PRD §5.2, §8.2). Headers
 * are the exact xlsx/CSV column names the template exposes; `key` is the
 * normalized field name used internally after parsing.
 */
export interface TemplateColumn {
  header: string;
  key: string;
  example: string;
  required: boolean;
}

export const SERVICE_TRANSACTION_COLUMNS: TemplateColumn[] = [
  { header: "Tanggal Layanan", key: "serviceDate", example: "2026-08-05", required: true },
  { header: "Kode Unit Kerja", key: "workUnitCode", example: "IGD", required: true },
  { header: "Kode/No. RM Pasien", key: "patientRmCode", example: "00-12-34-56", required: true },
  { header: "Jenis Layanan/Tindakan", key: "serviceName", example: "Konsultasi Dokter Umum", required: true },
  { header: "Status Penjaminan (JKN/NON_JKN)", key: "guaranteeStatus", example: "JKN", required: true },
  { header: "Nilai Tarif/Klaim", key: "tariffAmount", example: "150000", required: true },
  { header: "NIP Pegawai Pelaksana", key: "employeeNip", example: "198501012010011001", required: true },
  {
    header: "Peran (DPJP/OPERATOR/CO_OPERATOR/ANESTESI/PELAKSANA)",
    key: "serviceRole",
    example: "DPJP",
    required: true,
  },
];

export const ATTENDANCE_COLUMNS: TemplateColumn[] = [
  { header: "NIP Pegawai", key: "employeeNip", example: "198501012010011001", required: true },
  { header: "Jumlah Hari Cuti", key: "leaveDays", example: "0", required: false },
  { header: "Jenis Cuti", key: "leaveType", example: "", required: false },
  { header: "Menjalani Pembinaan Disiplin (YA/TIDAK)", key: "disciplinaryAction", example: "TIDAK", required: false },
  { header: "Catatan Disiplin", key: "disciplinaryNotes", example: "", required: false },
  { header: "Terlibat Perkelahian (YA/TIDAK)", key: "fightDuringCoaching", example: "TIDAK", required: false },
  { header: "Jumlah Hari Diklat", key: "trainingDays", example: "0", required: false },
  { header: "Hari Absen Tugas Belajar per Minggu", key: "studyAssignmentAbsenceDaysPerWeek", example: "0", required: false },
  { header: "Persentase Kehadiran (%)", key: "attendancePercent", example: "100", required: true },
];

export const PERFORMANCE_SCORE_COLUMNS: TemplateColumn[] = [
  { header: "NIP Pegawai", key: "employeeNip", example: "198501012010011001", required: true },
  { header: "Skor Kualitas Pelaksanaan Kegiatan (0-100)", key: "qualityScore", example: "85", required: true },
  { header: "Catatan", key: "notes", example: "", required: false },
];

export const INDEXING_SCORE_COLUMNS: TemplateColumn[] = [
  { header: "NIP Pegawai", key: "employeeNip", example: "198501012010011001", required: true },
  {
    header: "Variabel (EXPERIENCE/SKILL/RISK/URGENCY/POSITION)",
    key: "variableCode",
    example: "EXPERIENCE",
    required: true,
  },
  { header: "Skor (0-100)", key: "score", example: "80", required: true },
];
