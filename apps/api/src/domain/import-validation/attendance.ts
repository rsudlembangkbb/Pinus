import { DEDUCTION_RULE_CODES } from "@pinus/shared";
import type { DeductionRuleCode } from "@pinus/shared";
import type { RowValidationResult, ValidationContext } from "./types.js";

export const ATTENDANCE_HEADERS = [
  "Kode Pegawai",
  "Jenis Ketidakhadiran",
  "Jumlah Hari",
  "Kode Aturan Potongan",
  "Persentase Potongan Override (%)",
  "Catatan",
] as const;

export interface MappedAttendanceRow {
  employeeId: string;
  leaveType: string | null;
  leaveDays: number | null;
  deductionRuleCode: DeductionRuleCode | null;
  disciplinaryPercentBp: number | null;
  notes: string | null;
}

export function validateAttendanceRow(
  raw: Record<string, unknown>,
  ctx: ValidationContext,
): RowValidationResult<MappedAttendanceRow> {
  const errors: string[] = [];

  const employeeNip = String(raw["Kode Pegawai"] ?? "").trim();
  const employee = ctx.employeesByNip.get(employeeNip);
  if (!employeeNip) errors.push("Kode Pegawai wajib diisi");
  else if (!employee) errors.push(`Pegawai dengan NIP "${employeeNip}" tidak ditemukan pada master data`);

  const deductionRuleRaw = String(raw["Kode Aturan Potongan"] ?? "").trim().toUpperCase();
  let deductionRuleCode: DeductionRuleCode | null = null;
  if (deductionRuleRaw) {
    const match = DEDUCTION_RULE_CODES.find((c) => c === deductionRuleRaw);
    if (!match) errors.push(`Kode Aturan Potongan harus salah satu dari: ${DEDUCTION_RULE_CODES.join(", ")} (atau dikosongkan)`);
    deductionRuleCode = match ?? null;
  }

  const overridePercentRaw = raw["Persentase Potongan Override (%)"];
  let disciplinaryPercentBp: number | null = null;
  if (overridePercentRaw !== null && overridePercentRaw !== undefined && String(overridePercentRaw).trim() !== "") {
    const pct = Number(overridePercentRaw);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      errors.push("Persentase Potongan Override (%) harus angka 0-100");
    } else {
      disciplinaryPercentBp = Math.round(pct * 100);
    }
  }

  const leaveDaysRaw = raw["Jumlah Hari"];
  let leaveDays: number | null = null;
  if (leaveDaysRaw !== null && leaveDaysRaw !== undefined && String(leaveDaysRaw).trim() !== "") {
    const days = Number(leaveDaysRaw);
    if (!Number.isFinite(days) || days < 0) errors.push("Jumlah Hari harus angka >= 0");
    else leaveDays = days;
  }

  if (errors.length > 0 || !employee) {
    return { status: "ERROR", errors, mapped: null };
  }

  return {
    status: "OK",
    errors: [],
    mapped: {
      employeeId: employee.id,
      leaveType: String(raw["Jenis Ketidakhadiran"] ?? "").trim() || null,
      leaveDays,
      deductionRuleCode,
      disciplinaryPercentBp,
      notes: String(raw["Catatan"] ?? "").trim() || null,
    },
  };
}
