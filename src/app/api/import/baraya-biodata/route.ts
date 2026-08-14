import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { OPERATOR_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { parseWorkbookRows } from '@/lib/xlsx';
import { buildLookups, createImportBatch, finalizeBatch, readUploadedFile, recordRowErrors, storeRawFile } from '@/lib/import-shared';
import { validateBiodataRow } from '@/domain/import/validators';
import { writeAuditLog } from '@/lib/audit';

/**
 * Biodata sync differs from the other import pipelines: BARAYA is the
 * source of truth for employee master data (PRD 2.3.2), so a row with no
 * existing identity mapping creates a brand new employee + mapping rather
 * than being flagged as an unmatched-identity error.
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, OPERATOR_ROLES);

  const parsedInput = await readUploadedFile(req);
  if ('error' in parsedInput) return jsonError(parsedInput.error, 422);
  const { file, periodId } = parsedInput;

  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, periodId)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);

  const buffer = await file.arrayBuffer();
  const r2Key = await storeRawFile(periodId, 'baraya_biodata', file);
  const batchId = await createImportBatch(db, { periodId, source: 'baraya_biodata', fileName: file.name, r2Key, uploadedBy: session.sub });

  const { rows } = parseWorkbookRows(buffer);
  const lookups = await buildLookups(db, 'baraya');

  let created = 0;
  let updated = 0;
  const errors: { rowNumber: number; column?: string; message: string }[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let idx = 0; idx < rows.length; idx++) {
    const result = validateBiodataRow(rows[idx]!, idx + 2, lookups);
    if ('error' in result) {
      errors.push(result.error);
      continue;
    }
    const r = result.data;
    const existingEmployeeId = lookups.employeeBySourceCode.get(r.employeeCode);

    if (existingEmployeeId) {
      await db
        .update(schema.employees)
        .set({
          name: r.name,
          category: r.category ?? undefined,
          workUnitId: r.workUnitId ?? undefined,
          position: r.position ?? undefined,
          employmentStatus: r.employmentStatus ?? undefined,
          isActive: r.isActive ?? undefined,
          nip: r.nip ?? undefined,
          syncedFromBarayaAt: now,
          updatedAt: now
        })
        .where(eq(schema.employees.id, existingEmployeeId));
      updated++;
    } else {
      const employeeId = newId('emp');
      await db.insert(schema.employees).values({
        id: employeeId,
        nip: r.nip,
        name: r.name,
        category: r.category ?? 'administrasi',
        workUnitId: r.workUnitId,
        position: r.position,
        employmentStatus: r.employmentStatus ?? 'pns',
        isActive: r.isActive ?? true,
        syncedFromBarayaAt: now
      });
      await db.insert(schema.employeeIdentityMappings).values({
        id: newId('map'),
        employeeId,
        sourceSystem: 'baraya',
        externalCode: r.employeeCode,
        notes: 'Dibuat otomatis dari sinkronisasi biodata BARAYA'
      });
      lookups.employeeBySourceCode.set(r.employeeCode, employeeId);
      created++;
    }
  }

  await recordRowErrors(db, batchId, errors);
  await finalizeBatch(db, batchId, { totalRows: rows.length, successRows: created + updated, failedRows: errors.length });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'import',
    entityType: 'import_batch',
    entityId: batchId,
    after: { source: 'baraya_biodata', periodId, created, updated, failedRows: errors.length }
  });

  return jsonOk({ batchId, totalRows: rows.length, created, updated, failedRows: errors.length, sampleErrors: errors.slice(0, 20) });
});
