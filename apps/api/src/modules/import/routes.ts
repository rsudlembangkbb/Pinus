import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { IMPORT_BATCH_KINDS } from "@pinus/shared";
import type { ImportBatchKind, ImportRowStatus } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { ATTENDANCE_HEADERS, validateAttendanceRow } from "../../domain/import-validation/attendance.js";
import { PERFORMANCE_SCORE_HEADERS, validatePerformanceScoreRow } from "../../domain/import-validation/performanceScores.js";
import { SERVICE_TRANSACTION_HEADERS, validateServiceTransactionRow } from "../../domain/import-validation/serviceTransactions.js";
import type { ValidationContext } from "../../domain/import-validation/types.js";
import { buildTemplateWorkbook, parseWorkbookFirstSheet } from "../../lib/excel.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { offsetFor, parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const importRoutes = new Hono<AppEnv>();
importRoutes.use("*", requireAuth);

const TEMPLATE_EXAMPLES: Record<ImportBatchKind, { headers: readonly string[]; example: Record<string, unknown> }> = {
  SERVICE_TRANSACTIONS: {
    headers: SERVICE_TRANSACTION_HEADERS,
    example: {
      "Tanggal Layanan": "2026-08-05",
      "Kode Unit Kerja": "RI-01",
      "Kode/No. RM Pasien": "00012345",
      "Jenis Layanan/Tindakan": "Rawat Inap Kelas 2",
      "Status Penjaminan": "JKN",
      "Nilai Tarif/Klaim": 1500000,
      "Kode Pegawai Pelaksana": "198501012010011001",
      "Peran dalam Tindakan": "DPJP",
    },
  },
  ATTENDANCE: {
    headers: ATTENDANCE_HEADERS,
    example: {
      "Kode Pegawai": "198501012010011001",
      "Jenis Ketidakhadiran": "Cuti Melahirkan",
      "Jumlah Hari": 30,
      "Kode Aturan Potongan": "CUTI_GE_1_BULAN",
      "Persentase Potongan Override (%)": "",
      Catatan: "",
    },
  },
  PERFORMANCE_SCORES: {
    headers: PERFORMANCE_SCORE_HEADERS,
    example: {
      "Kode Pegawai": "198501012010011001",
      Variabel: "CAPAIAN_KINERJA",
      Skor: 0,
      "Skor Kehadiran": 95,
      "Skor Kualitas Kerja": 90,
      Catatan: "",
    },
  },
};

importRoutes.get("/template/:kind", requirePermission("import.read"), async (c) => {
  const kind = c.req.param("kind") as ImportBatchKind;
  const spec = TEMPLATE_EXAMPLES[kind];
  if (!spec) throw Errors.badRequest("Jenis impor tidak dikenal");
  const buffer = buildTemplateWorkbook(spec.headers, [spec.example]);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-${kind.toLowerCase()}.xlsx"`,
    },
  });
});

importRoutes.get("/batches", requirePermission("import.read"), async (c) => {
  const db = c.get("db");
  const { page, pageSize } = parsePagination(c);
  const periodId = c.req.query("periodId");
  const conditions = [periodId ? eq(schema.importBatches.periodId, periodId) : undefined].filter(Boolean);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(schema.importBatches)
    .where(where)
    .orderBy(schema.importBatches.uploadedAt)
    .limit(pageSize)
    .offset(offsetFor(page, pageSize));
  return c.json({ items: items.reverse(), page, pageSize });
});

importRoutes.get("/batches/:id", requirePermission("import.read"), async (c) => {
  const db = c.get("db");
  const batch = await db.query.importBatches.findFirst({ where: eq(schema.importBatches.id, c.req.param("id")) });
  if (!batch) throw Errors.notFound("Batch impor");
  return c.json(batch);
});

importRoutes.get("/batches/:id/rows", requirePermission("import.read"), async (c) => {
  const db = c.get("db");
  const { page, pageSize } = parsePagination(c);
  const status = c.req.query("status") as ImportRowStatus | undefined;
  const batchId = c.req.param("id");

  const conditions = [eq(schema.importRows.batchId, batchId), status ? eq(schema.importRows.status, status) : undefined].filter(
    Boolean,
  );
  const rows = await db
    .select()
    .from(schema.importRows)
    .where(and(...conditions))
    .limit(pageSize)
    .offset(offsetFor(page, pageSize));

  return c.json({
    items: rows.map((r) => ({ ...r, raw: JSON.parse(r.rawJson), errors: JSON.parse(r.errorsJson) })),
    page,
    pageSize,
  });
});

importRoutes.post("/batches", requirePermission("import.upload"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const form = await c.req.parseBody();

  const kind = form["kind"] as ImportBatchKind;
  const periodId = form["periodId"] as string;
  const file = form["file"];
  if (!IMPORT_BATCH_KINDS.includes(kind)) throw Errors.badRequest("Jenis impor tidak dikenal");
  if (!periodId) throw Errors.badRequest("periodId wajib diisi");
  if (!(file instanceof File)) throw Errors.badRequest("Berkas wajib diunggah (field 'file')");

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) });
  if (!period) throw Errors.notFound("Periode");
  if (period.status === "FINAL") throw Errors.conflict("Periode sudah final dan terkunci, tidak dapat menerima impor baru");

  const buffer = await file.arrayBuffer();
  let rawRows: Record<string, unknown>[];
  try {
    rawRows = parseWorkbookFirstSheet(buffer);
  } catch {
    throw Errors.badRequest("Berkas tidak dapat dibaca. Pastikan format .xlsx atau .csv sesuai template.");
  }
  if (rawRows.length === 0) throw Errors.badRequest("Berkas tidak memiliki baris data");

  const batchId = newId();
  const r2Key = `imports/${periodId}/${batchId}/${file.name}`;
  await c.env.FILES.put(r2Key, buffer, { httpMetadata: { contentType: file.type || "application/octet-stream" } });

  const ctx: ValidationContext = await buildValidationContext(db, period.year, period.month);
  const seenKeys = new Set<string>();

  let successRows = 0;
  let errorRows = 0;
  const rowInserts: (typeof schema.importRows.$inferInsert)[] = [];

  rawRows.forEach((raw, index) => {
    const result = validateRow(kind, raw, ctx);
    let status = result.status;
    let errors = result.errors;

    if (status === "OK" && kind === "SERVICE_TRANSACTIONS") {
      const mapped = result.mapped as ReturnType<typeof validateServiceTransactionRow>["mapped"];
      const dedupKey = `${mapped!.serviceDate}|${mapped!.workUnitId}|${mapped!.patientRef}|${mapped!.employeeId}|${mapped!.serviceRole}|${mapped!.serviceName}`;
      if (seenKeys.has(dedupKey)) {
        status = "WARNING";
        errors = [...errors, "Baris berpotensi duplikat dengan baris lain pada berkas ini"];
      }
      seenKeys.add(dedupKey);
    }

    if (status === "OK" || status === "WARNING") successRows++;
    else errorRows++;

    rowInserts.push({
      id: newId(),
      batchId,
      rowNumber: index + 2, // header is row 1
      rawJson: JSON.stringify(raw),
      status,
      errorsJson: JSON.stringify(errors),
      mappedEmployeeId: (result.mapped as { employeeId?: string } | null)?.employeeId ?? null,
      mappedWorkUnitId: (result.mapped as { workUnitId?: string } | null)?.workUnitId ?? null,
    });
  });

  await db.insert(schema.importBatches).values({
    id: batchId,
    kind,
    periodId,
    fileName: file.name,
    fileR2Key: r2Key,
    uploadedBy: user.id,
    status: "VALIDATED",
    totalRows: rawRows.length,
    successRows,
    errorRows,
  });

  // D1 batch insert: chunk to stay well under statement/variable limits.
  const CHUNK = 50;
  for (let i = 0; i < rowInserts.length; i += CHUNK) {
    const chunk = rowInserts.slice(i, i + CHUNK);
    await db.insert(schema.importRows).values(chunk);
  }

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "import_batch",
    entityId: batchId,
    after: { kind, periodId, fileName: file.name, totalRows: rawRows.length, successRows, errorRows },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  const batch = await db.query.importBatches.findFirst({ where: eq(schema.importBatches.id, batchId) });
  return c.json(batch, 201);
});

importRoutes.post("/batches/:id/commit", requirePermission("import.commit"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const batchId = c.req.param("id");

  const batch = await db.query.importBatches.findFirst({ where: eq(schema.importBatches.id, batchId) });
  if (!batch) throw Errors.notFound("Batch impor");
  if (batch.status === "COMMITTED") throw Errors.conflict("Batch ini sudah dikomit sebelumnya");

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, batch.periodId) });
  if (!period) throw Errors.notFound("Periode");
  if (period.status === "FINAL") throw Errors.conflict("Periode sudah final dan terkunci");

  const okRows = await db
    .select()
    .from(schema.importRows)
    .where(and(eq(schema.importRows.batchId, batchId), eq(schema.importRows.status, "OK")));
  const warningRows = await db
    .select()
    .from(schema.importRows)
    .where(and(eq(schema.importRows.batchId, batchId), eq(schema.importRows.status, "WARNING")));
  const committable = [...okRows, ...warningRows];

  let committedCount = 0;
  const CHUNK = 50;

  if (batch.kind === "SERVICE_TRANSACTIONS") {
    // Re-validate against current master data at commit time (master data
    // may have changed since upload) instead of trusting the staged mapping.
    const ctx = await buildValidationContext(db, period.year, period.month);
    const rows: (typeof schema.serviceTransactions.$inferInsert)[] = [];
    for (const row of committable) {
      const raw = JSON.parse(row.rawJson);
      const result = validateServiceTransactionRow(raw, ctx);
      if (!result.mapped) continue;
      rows.push({ id: newId(), periodId: period.id, importBatchId: batchId, ...result.mapped });
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insert(schema.serviceTransactions).values(rows.slice(i, i + CHUNK));
    }
    committedCount = rows.length;
  } else if (batch.kind === "ATTENDANCE") {
    const ctx = await buildValidationContext(db, period.year, period.month);
    const rows: (typeof schema.attendanceRecords.$inferInsert)[] = [];
    for (const row of committable) {
      const raw = JSON.parse(row.rawJson);
      const result = validateAttendanceRow(raw, ctx);
      if (!result.mapped) continue;
      rows.push({ id: newId(), periodId: period.id, importBatchId: batchId, ...result.mapped });
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insert(schema.attendanceRecords).values(rows.slice(i, i + CHUNK));
    }
    committedCount = rows.length;
  } else if (batch.kind === "PERFORMANCE_SCORES") {
    const ctx = await buildValidationContext(db, period.year, period.month);
    for (const row of committable) {
      const raw = JSON.parse(row.rawJson);
      const result = validatePerformanceScoreRow(raw, ctx);
      if (!result.mapped) continue;
      const existing = await db.query.performanceScores.findFirst({
        where: and(
          eq(schema.performanceScores.employeeId, result.mapped.employeeId),
          eq(schema.performanceScores.periodId, period.id),
          eq(schema.performanceScores.variable, result.mapped.variable),
        ),
      });
      if (existing) {
        await db
          .update(schema.performanceScores)
          .set({ ...result.mapped, scoredBy: user.id, scoredAt: new Date().toISOString() })
          .where(eq(schema.performanceScores.id, existing.id));
      } else {
        await db.insert(schema.performanceScores).values({ id: newId(), periodId: period.id, scoredBy: user.id, ...result.mapped });
      }
      committedCount++;
    }
  }

  await db
    .update(schema.importBatches)
    .set({ status: "COMMITTED", committedAt: new Date().toISOString(), committedBy: user.id })
    .where(eq(schema.importBatches.id, batchId));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "IMPORT_COMMIT",
    entityType: "import_batch",
    entityId: batchId,
    after: { committedCount },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  const updated = await db.query.importBatches.findFirst({ where: eq(schema.importBatches.id, batchId) });
  return c.json({ batch: updated, committedCount });
});

function validateRow(kind: ImportBatchKind, raw: Record<string, unknown>, ctx: ValidationContext) {
  if (kind === "SERVICE_TRANSACTIONS") return validateServiceTransactionRow(raw, ctx);
  if (kind === "ATTENDANCE") return validateAttendanceRow(raw, ctx);
  return validatePerformanceScoreRow(raw, ctx);
}

async function buildValidationContext(
  db: AppEnv["Variables"]["db"],
  periodYear: number,
  periodMonth: number,
): Promise<ValidationContext> {
  const employees = await db.select().from(schema.employees);
  const workUnits = await db.select().from(schema.workUnits);
  return {
    employeesByNip: new Map(employees.map((e) => [e.nip, { id: e.id, isActive: e.isActive }])),
    workUnitsByCode: new Map(workUnits.map((w) => [w.code, { id: w.id, isActive: w.isActive }])),
    periodYear,
    periodMonth,
  };
}
