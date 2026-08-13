import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireSession, withApi } from '@/lib/http';

export const POST = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  const db = await getDb();
  await db
    .update(schema.notifications)
    .set({ isRead: true, updatedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(schema.notifications.id, resolvedParams.id), eq(schema.notifications.userId, session.sub)));
  return jsonOk({ success: true });
});
