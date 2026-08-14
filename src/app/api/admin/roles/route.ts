import { asc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireSession, withApi } from '@/lib/http';

export const GET = withApi(async () => {
  await requireSession();
  const db = await getDb();
  const rows = await db.select().from(schema.roles).orderBy(asc(schema.roles.name));
  return jsonOk(rows);
});
