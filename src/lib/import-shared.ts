import { eq } from 'drizzle-orm';
import { getDb, getEnv, schema, Db } from '@/db';
import { newId } from '@/lib/ids';
import { Lookups, RowError } from '@/domain/import/validators';

export async function buildLookups(db: Db, identitySource: string): Promise<Lookups> {
  const units = await db.select().from(schema.workUnits);
  const workUnitByCode = new Map(units.map((u) => [u.code.toUpperCase(), u.id]));

  const mappings = await db
    .select()
    .from(schema.employeeIdentityMappings)
    .where(eq(schema.employeeIdentityMappings.sourceSystem, identitySource));
  const employeeBySourceCode = new Map(mappings.map((m) => [m.externalCode, m.employeeId]));

  return { workUnitByCode, employeeBySourceCode };
}

export async function readUploadedFile(req: Request): Promise<{ file: File; periodId: string } | { error: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: 'Berkas tidak dapat dibaca. Pastikan mengunggah file Excel (.xlsx) yang valid.' };
  }
  const file = form.get('file');
  const periodId = form.get('periodId');
  if (!(file instanceof File)) return { error: 'Berkas wajib diunggah.' };
  if (typeof periodId !== 'string' || !periodId) return { error: 'Periode wajib dipilih.' };
  if (file.size > 15 * 1024 * 1024) return { error: 'Ukuran berkas maksimal 15MB.' };
  const allowedExt = ['.xlsx', '.xls', '.csv'];
  if (!allowedExt.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return { error: 'Format berkas harus .xlsx, .xls, atau .csv.' };
  }
  return { file, periodId };
}

export async function storeRawFile(periodId: string, source: string, file: File): Promise<string> {
  const env = await getEnv();
  const key = `imports/${periodId}/${source}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buffer = await file.arrayBuffer();
  await env.FILES.put(key, buffer, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  return key;
}

export async function createImportBatch(
  db: Db,
  params: { periodId: string; source: string; fileName: string; r2Key: string; uploadedBy: string }
): Promise<string> {
  const id = newId('imp');
  await db.insert(schema.importBatches).values({
    id,
    periodId: params.periodId,
    source: params.source,
    fileName: params.fileName,
    r2Key: params.r2Key,
    uploadedBy: params.uploadedBy,
    status: 'processing'
  });
  return id;
}

export async function finalizeBatch(
  db: Db,
  batchId: string,
  counts: { totalRows: number; successRows: number; failedRows: number }
): Promise<void> {
  await db
    .update(schema.importBatches)
    .set({
      status: counts.failedRows > 0 && counts.successRows === 0 ? 'failed' : 'committed',
      totalRows: counts.totalRows,
      successRows: counts.successRows,
      failedRows: counts.failedRows,
      committedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(schema.importBatches.id, batchId));
}

/**
 * Chunked, concurrent inserts. D1's HTTP-based driver has no real benefit
 * from `db.batch()` over a handful of concurrent awaited statements for
 * our row counts (hundreds, not millions), and this sidesteps `db.batch`'s
 * awkward "at least one element" tuple typing for a dynamically-sized
 * array of heterogeneous insert builders.
 */
const CHUNK_SIZE = 50;

export async function recordRowErrors(db: Db, batchId: string, errors: RowError[]): Promise<void> {
  if (errors.length === 0) return;
  for (let i = 0; i < errors.length; i += CHUNK_SIZE) {
    const chunk = errors.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((e) =>
        db.insert(schema.importRowErrors).values({
          id: newId('imperr'),
          batchId,
          rowNumber: e.rowNumber,
          columnName: e.column ?? null,
          errorMessage: e.message
        })
      )
    );
  }
}

export async function insertRowsChunked<T>(db: Db, buildStatement: (row: T) => PromiseLike<unknown>, rows: T[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map((r) => buildStatement(r)));
  }
}
