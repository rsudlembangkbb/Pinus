import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { formatRupiah } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { buildDataWorkbook } from "../../lib/excel.js";
import { Errors } from "../../lib/errors.js";
import { generateSlipPdf } from "../../lib/pdf.js";
import { buildZip } from "../../lib/zip.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const reportRoutes = new Hono<AppEnv>();
reportRoutes.use("*", requireAuth, requirePermission("report.export"));

async function loadPeriodResults(db: AppEnv["Variables"]["db"], periodId: string) {
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) });
  if (!period) throw Errors.notFound("Periode");

  const rows = await db
    .select({
      result: schema.calculationResults,
      employee: schema.employees,
      workUnit: schema.workUnits,
    })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.employees.id, schema.calculationResults.employeeId))
    .innerJoin(schema.workUnits, eq(schema.workUnits.id, schema.employees.workUnitId))
    .where(eq(schema.calculationResults.periodId, periodId));

  return { period, rows };
}

reportRoutes.get("/periods/:id/rekap-unit.xlsx", async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const { period, rows } = await loadPeriodResults(db, c.req.param("id"));

  const sheetRows = rows
    .sort((a, b) => a.workUnit.name.localeCompare(b.workUnit.name) || a.employee.fullName.localeCompare(b.employee.fullName))
    .map((r) => ({
      "Unit Kerja": r.workUnit.name,
      NIP: r.employee.nip,
      "Nama Pegawai": r.employee.fullName,
      Kategori: r.employee.category,
      "Jenis Mesin": r.result.engineKind,
      "Jumlah Kotor": r.result.grossAmount,
      Potongan: r.result.deductionAmount,
      "Jumlah Diterima": r.result.netAmount,
    }));

  const buffer = buildDataWorkbook([{ name: "Rekap per Unit", rows: sheetRows }]);
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "EXPORT",
    entityType: "report_rekap_unit",
    entityId: period.id,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-unit-${period.code}.xlsx"`,
    },
  });
});

reportRoutes.get("/periods/:id/rekap-total.xlsx", async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const { period, rows } = await loadPeriodResults(db, c.req.param("id"));

  const byUnit = new Map<string, { unit: string; count: number; gross: number; deduction: number; net: number }>();
  for (const r of rows) {
    const agg = byUnit.get(r.workUnit.id) ?? { unit: r.workUnit.name, count: 0, gross: 0, deduction: 0, net: 0 };
    agg.count += 1;
    agg.gross += r.result.grossAmount;
    agg.deduction += r.result.deductionAmount;
    agg.net += r.result.netAmount;
    byUnit.set(r.workUnit.id, agg);
  }

  const sheetRows = [...byUnit.values()]
    .sort((a, b) => a.unit.localeCompare(b.unit))
    .map((a) => ({
      "Unit Kerja": a.unit,
      "Jumlah Pegawai": a.count,
      "Total Kotor": a.gross,
      "Total Potongan": a.deduction,
      "Total Diterima": a.net,
    }));
  const grandTotal = rows.reduce((sum, r) => sum + r.result.netAmount, 0);
  sheetRows.push({
    "Unit Kerja": "TOTAL PERIODE",
    "Jumlah Pegawai": rows.length,
    "Total Kotor": rows.reduce((s, r) => s + r.result.grossAmount, 0),
    "Total Potongan": rows.reduce((s, r) => s + r.result.deductionAmount, 0),
    "Total Diterima": grandTotal,
  });

  const buffer = buildDataWorkbook([{ name: "Rekap Total", rows: sheetRows }]);
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "EXPORT",
    entityType: "report_rekap_total",
    entityId: period.id,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-total-${period.code}.xlsx"`,
    },
  });
});

reportRoutes.get("/periods/:id/raw-data.xlsx", async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const periodId = c.req.param("id");
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) });
  if (!period) throw Errors.notFound("Periode");

  const transactions = await db
    .select({ tx: schema.serviceTransactions, employee: schema.employees, workUnit: schema.workUnits })
    .from(schema.serviceTransactions)
    .innerJoin(schema.employees, eq(schema.employees.id, schema.serviceTransactions.employeeId))
    .innerJoin(schema.workUnits, eq(schema.workUnits.id, schema.serviceTransactions.workUnitId))
    .where(eq(schema.serviceTransactions.periodId, periodId));

  const { rows: resultRows } = await loadPeriodResults(db, periodId);

  const buffer = buildDataWorkbook([
    {
      name: "Transaksi Layanan",
      rows: transactions.map((t) => ({
        Tanggal: t.tx.serviceDate,
        "Unit Kerja": t.workUnit.name,
        "No. RM": t.tx.patientRef,
        Layanan: t.tx.serviceName,
        Penjaminan: t.tx.penjaminanStatus,
        Tarif: t.tx.tariffValue,
        NIP: t.employee.nip,
        Pegawai: t.employee.fullName,
        Peran: t.tx.serviceRole,
      })),
    },
    {
      name: "Hasil Kalkulasi",
      rows: resultRows.map((r) => ({
        NIP: r.employee.nip,
        Pegawai: r.employee.fullName,
        "Unit Kerja": r.workUnit.name,
        Mesin: r.result.engineKind,
        Kotor: r.result.grossAmount,
        Potongan: r.result.deductionAmount,
        "Faktor Penyesuaian (%)": r.result.adjustmentFactorBp / 100,
        Diterima: r.result.netAmount,
      })),
    },
  ]);

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "EXPORT",
    entityType: "report_raw_data",
    entityId: periodId,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="data-mentah-${period.code}.xlsx"`,
    },
  });
});

reportRoutes.get("/periods/:id/slips.zip", async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const { period, rows } = await loadPeriodResults(db, c.req.param("id"));
  if (rows.length === 0) throw Errors.notFound("Hasil kalkulasi untuk periode ini");

  const entries = [];
  for (const r of rows) {
    const pdfBytes = await generateSlipPdf({
      employee: { fullName: r.employee.fullName, nip: r.employee.nip, workUnitName: r.workUnit.name, category: r.employee.category },
      period: { label: period.label, code: period.code, status: period.status as never },
      result: {
        engineKind: r.result.engineKind as never,
        grossAmount: r.result.grossAmount,
        deductionAmount: r.result.deductionAmount,
        deductionRuleCodes: JSON.parse(r.result.deductionRuleCodesJson),
        minimumRequirementApplied: r.result.minimumRequirementApplied,
        minimumRequirementAmount: r.result.minimumRequirementAmount,
        adjustmentFactorBp: r.result.adjustmentFactorBp,
        netAmount: r.result.netAmount,
        components: JSON.parse(r.result.componentsJson),
      },
      generatedAt: new Date().toISOString(),
    });
    entries.push({ name: `${r.workUnit.code}/${r.employee.nip}-${r.employee.fullName.replace(/[/\\]/g, "-")}.pdf`, data: pdfBytes });
  }

  const zipBytes = buildZip(entries);
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "EXPORT",
    entityType: "report_slips_batch",
    entityId: period.id,
    after: { count: entries.length, totalNet: rows.reduce((s, r) => s + r.result.netAmount, 0), totalNetFormatted: formatRupiah(rows.reduce((s, r) => s + r.result.netAmount, 0)) },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  return new Response(zipBytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="slip-jaspel-${period.code}.zip"`,
    },
  });
});
