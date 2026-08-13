import { INDEXING_VARIABLES } from "@pinus/shared";
import type { IndexingVariable } from "@pinus/shared";
import type { RowValidationResult, ValidationContext } from "./types.js";

export const PERFORMANCE_SCORE_HEADERS = [
  "Kode Pegawai",
  "Variabel",
  "Skor",
  "Skor Kehadiran",
  "Skor Kualitas Kerja",
  "Catatan",
] as const;

export interface MappedPerformanceScoreRow {
  employeeId: string;
  variable: IndexingVariable;
  score: number;
  attendanceScore: number | null;
  qualityScore: number | null;
  notes: string | null;
}

export function validatePerformanceScoreRow(
  raw: Record<string, unknown>,
  ctx: ValidationContext,
): RowValidationResult<MappedPerformanceScoreRow> {
  const errors: string[] = [];

  const employeeNip = String(raw["Kode Pegawai"] ?? "").trim();
  const employee = ctx.employeesByNip.get(employeeNip);
  if (!employeeNip) errors.push("Kode Pegawai wajib diisi");
  else if (!employee) errors.push(`Pegawai dengan NIP "${employeeNip}" tidak ditemukan pada master data`);

  const variableRaw = String(raw["Variabel"] ?? "").trim().toUpperCase().replace(/[\s-]/g, "_");
  const variable = INDEXING_VARIABLES.find((v) => v === variableRaw);
  if (!variable) errors.push(`Variabel harus salah satu dari: ${INDEXING_VARIABLES.join(", ")}`);

  const scoreRaw = raw["Skor"];
  const score = Number(scoreRaw);
  if (!Number.isFinite(score) || score < 0) errors.push("Skor harus angka >= 0");

  let attendanceScore: number | null = null;
  let qualityScore: number | null = null;
  if (variable === "CAPAIAN_KINERJA") {
    const att = Number(raw["Skor Kehadiran"]);
    const qual = Number(raw["Skor Kualitas Kerja"]);
    if (!Number.isFinite(att) || !Number.isFinite(qual)) {
      errors.push("Variabel CAPAIAN_KINERJA wajib mengisi Skor Kehadiran dan Skor Kualitas Kerja");
    } else {
      attendanceScore = att;
      qualityScore = qual;
    }
  }

  if (errors.length > 0 || !employee || !variable) {
    return { status: "ERROR", errors, mapped: null };
  }

  return {
    status: "OK",
    errors: [],
    mapped: {
      employeeId: employee.id,
      variable,
      score: Math.round(score),
      attendanceScore,
      qualityScore,
      notes: String(raw["Catatan"] ?? "").trim() || null,
    },
  };
}
