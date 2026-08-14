import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { READ_ONLY_AUDIT_ROLES } from '@/lib/auth/roles';

export const GET = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, READ_ONLY_AUDIT_ROLES);

  const db = await getDb();
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '200');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;

  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(limit);
  return jsonOk(rows);
});
