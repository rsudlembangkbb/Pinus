import { PENJAMINAN_STATUSES, SERVICE_ROLES } from "@pinus/shared";
import type { PenjaminanStatus, ServiceRole } from "@pinus/shared";
import type { RowValidationResult, ValidationContext } from "./types.js";

export const SERVICE_TRANSACTION_HEADERS = [
  "Tanggal Layanan",
  "Kode Unit Kerja",
  "Kode/No. RM Pasien",
  "Jenis Layanan/Tindakan",
  "Status Penjaminan",
  "Nilai Tarif/Klaim",
  "Kode Pegawai Pelaksana",
  "Peran dalam Tindakan",
] as const;

export interface MappedServiceTransactionRow {
  serviceDate: string;
  workUnitId: string;
  patientRef: string;
  serviceName: string;
  penjaminanStatus: PenjaminanStatus;
  tariffValue: number;
  employeeId: string;
  serviceRole: ServiceRole;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateServiceTransactionRow(
  raw: Record<string, unknown>,
  ctx: ValidationContext,
): RowValidationResult<MappedServiceTransactionRow> {
  const errors: string[] = [];

  const serviceDate = String(raw["Tanggal Layanan"] ?? "").trim();
  if (!DATE_RE.test(serviceDate)) {
    errors.push("Tanggal Layanan harus berformat YYYY-MM-DD");
  } else {
    const [y, m] = serviceDate.split("-").map(Number);
    if (y !== ctx.periodYear || m !== ctx.periodMonth) {
      errors.push(`Tanggal Layanan (${serviceDate}) di luar periode ${ctx.periodYear}-${String(ctx.periodMonth).padStart(2, "0")}`);
    }
  }

  const workUnitCode = String(raw["Kode Unit Kerja"] ?? "").trim();
  const workUnit = ctx.workUnitsByCode.get(workUnitCode);
  if (!workUnitCode) errors.push("Kode Unit Kerja wajib diisi");
  else if (!workUnit) errors.push(`Kode Unit Kerja "${workUnitCode}" tidak ditemukan pada master data`);
  else if (!workUnit.isActive) errors.push(`Unit Kerja "${workUnitCode}" tidak aktif`);

  const patientRef = String(raw["Kode/No. RM Pasien"] ?? "").trim();
  if (!patientRef) errors.push("Kode/No. RM Pasien wajib diisi");

  const serviceName = String(raw["Jenis Layanan/Tindakan"] ?? "").trim();
  if (!serviceName) errors.push("Jenis Layanan/Tindakan wajib diisi");

  const penjaminanRaw = String(raw["Status Penjaminan"] ?? "").trim().toUpperCase().replace(/[\s-]/g, "_");
  const penjaminanStatus = PENJAMINAN_STATUSES.find((s) => s === penjaminanRaw);
  if (!penjaminanStatus) errors.push(`Status Penjaminan harus salah satu dari: ${PENJAMINAN_STATUSES.join(", ")}`);

  const tariffRaw = raw["Nilai Tarif/Klaim"];
  const tariffValue =
    typeof tariffRaw === "number" ? tariffRaw : Number(String(tariffRaw ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(tariffValue) || tariffValue <= 0) {
    errors.push("Nilai Tarif/Klaim harus berupa angka positif");
  }

  const employeeNip = String(raw["Kode Pegawai Pelaksana"] ?? "").trim();
  const employee = ctx.employeesByNip.get(employeeNip);
  if (!employeeNip) errors.push("Kode Pegawai Pelaksana wajib diisi");
  else if (!employee) errors.push(`Pegawai dengan NIP "${employeeNip}" tidak ditemukan pada master data`);
  else if (!employee.isActive) errors.push(`Pegawai NIP "${employeeNip}" berstatus nonaktif`);

  const serviceRoleRaw = String(raw["Peran dalam Tindakan"] ?? "").trim().toUpperCase().replace(/[\s-]/g, "_");
  const serviceRole = SERVICE_ROLES.find((r) => r === serviceRoleRaw);
  if (!serviceRole) errors.push(`Peran dalam Tindakan harus salah satu dari: ${SERVICE_ROLES.join(", ")}`);

  if (errors.length > 0 || !workUnit || !employee || !penjaminanStatus || !serviceRole) {
    return { status: "ERROR", errors, mapped: null };
  }

  return {
    status: "OK",
    errors: [],
    mapped: {
      serviceDate,
      workUnitId: workUnit.id,
      patientRef,
      serviceName,
      penjaminanStatus,
      tariffValue: Math.round(tariffValue),
      employeeId: employee.id,
      serviceRole,
    },
  };
}
