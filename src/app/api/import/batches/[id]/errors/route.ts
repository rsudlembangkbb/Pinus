import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireSession, withApi } from '@/lib/http';

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  await requireSession();
  const db = await getDb();
  const rows = await db.select().from(schema.importRowErrors).where(eq(schema.importRowErrors.batchId, resolvedParams.id)).limit(1000);
  return jsonOk(rows);
});
