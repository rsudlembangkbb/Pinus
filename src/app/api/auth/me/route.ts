import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonOk, requireSession, withApi } from '@/lib/http';
import { ROLE_LABELS, RoleCode } from '@/lib/auth/roles';

export const GET = withApi(async (_req: NextRequest) => {
  const session = await requireSession();
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.sub)).limit(1);
  if (!user) return jsonOk(null, 401);

  let unit: { id: string; name: string } | null = null;
  if (user.workUnitId) {
    const [u] = await db.select().from(schema.workUnits).where(eq(schema.workUnits.id, user.workUnitId)).limit(1);
    if (u) unit = { id: u.id, name: u.name };
  }

  let employee: { id: string; name: string } | null = null;
  if (user.employeeId) {
    const [e] = await db.select().from(schema.employees).where(eq(schema.employees.id, user.employeeId)).limit(1);
    if (e) employee = { id: e.id, name: e.name };
  }

  return jsonOk({
    id: user.id,
    username: user.username,
    email: user.email,
    role: session.role,
    roleLabel: ROLE_LABELS[session.role as RoleCode] ?? session.role,
    workUnit: unit,
    employee,
    mustChangePassword: user.mustChangePassword
  });
});
