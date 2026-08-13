import { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireSession, withApi } from '@/lib/http';

export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireSession();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, session.sub))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(100);
  return jsonOk(rows);
});
