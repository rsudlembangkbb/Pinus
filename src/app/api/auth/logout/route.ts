import { NextRequest } from 'next/server';
import { jsonOk, withApi } from '@/lib/http';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit';
import { requireSession } from '@/lib/http';

export const POST = withApi(async (_req: NextRequest) => {
  const session = await requireSession().catch(() => null);
  if (session) {
    await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'logout', entityType: 'user', entityId: session.sub });
  }
  const res = jsonOk({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
