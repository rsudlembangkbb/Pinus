import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { OPERATOR_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { parseWorkbookRows } from '@/lib/xlsx';
import { buildLookups, createImportBatch, finalizeBatch, insertRowsChunked, readUploadedFile, recordRowErrors, storeRawFile } from '@/lib/import-shared';
import { validatePerformanceRow, ValidatedPerformanceRow } from '@/domain/import/validators';
import { writeAuditLog } from '@/lib/audit';

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, OPERATOR_ROLES);

  const parsedInput = await readUploadedFile(req);
  if ('error' in parsedInput) return jsonError(parsedInput.error, 422);
  const { file, periodId } = parsedInput;

  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, periodId)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);
  if (!['draft', 'importing'].includes(period.status)) return jsonError('Periode ini sudah melewati tahap impor data.', 409);

  const buffer = await file.arrayBuffer();
  const r2Key = await storeRawFile(periodId, 'kinerja', file);
  const batchId = await createImportBatch(db, { periodId, source: 'kinerja', fileName: file.name, r2Key, uploadedBy: session.sub });

  const { rows } = parseWorkbookRows(buffer);
  const lookups = await buildLookups(db, 'kinerja');

  const validRows: ValidatedPerformanceRow[] = [];
  const errors: { rowNumber: number; column?: string; message: string }[] = [];
  rows.forEach((row, idx) => {
    const result = validatePerformanceRow(row, idx + 2, lookups);
    if ('error' in result) errors.push(result.error);
    else validRows.push(result.data);
  });

  await insertRowsChunked(
    db,
    (r: ValidatedPerformanceRow) =>
      db.insert(schema.performanceScores).values({
        id: newId('perf'),
        periodId,
        batchId,
        employeeId: r.employeeId,
        externalEmployeeCode: r.externalEmployeeCode,
        category: r.category,
        componentScoresJson: JSON.stringify(r.componentScores),
        finalScore: r.finalScore,
        assessedBy: r.assessedBy,
        assessedAt: r.assessedAt
      }),
    validRows
  );

  await recordRowErrors(db, batchId, errors);
  await finalizeBatch(db, batchId, { totalRows: rows.length, successRows: validRows.length, failedRows: errors.length });

  if (period.status === 'draft') {
    await db.update(schema.calculationPeriods).set({ status: 'importing' }).where(eq(schema.calculationPeriods.id, periodId));
  }

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'import',
    entityType: 'import_batch',
    entityId: batchId,
    after: { source: 'kinerja', periodId, totalRows: rows.length, successRows: validRows.length, failedRows: errors.length }
  });

  return jsonOk({ batchId, totalRows: rows.length, successRows: validRows.length, failedRows: errors.length, sampleErrors: errors.slice(0, 20) });
});
