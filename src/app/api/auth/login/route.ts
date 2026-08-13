import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, or } from 'drizzle-orm';
import { getDb, getEnv, schema } from '@/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { jsonError, jsonOk, withApi, clientIp } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

const bodySchema = z.object({
  identifier: z.string().min(3), // username or email
  password: z.string().min(1)
});

export const POST = withApi(async (req: NextRequest) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError('Username/email dan kata sandi wajib diisi.', 422);

  const db = getDb();
  const identifier = parsed.data.identifier.trim().toLowerCase();

  const rows = await db
    .select({ user: schema.users, role: schema.roles })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .where(or(eq(schema.users.username, identifier), eq(schema.users.email, identifier)))
    .limit(1);

  const row = rows[0];

  if (!row || !row.user.isActive) {
    await writeAuditLog({ action: 'login_failed', entityType: 'user', entityId: identifier, ipAddress: clientIp(req) });
    return jsonError('Username/email atau kata sandi salah.', 401);
  }

  const valid = await verifyPassword(parsed.data.password, row.user.passwordHash);
  if (!valid) {
    await writeAuditLog({ action: 'login_failed', entityType: 'user', entityId: row.user.id, ipAddress: clientIp(req) });
    return jsonError('Username/email atau kata sandi salah.', 401);
  }

  const env = getEnv();
  const token = await createSessionToken(
    {
      sub: row.user.id,
      role: row.role.code,
      roleId: row.role.id,
      workUnitId: row.user.workUnitId,
      employeeId: row.user.employeeId,
      tokenVersion: row.user.tokenVersion,
      name: row.user.username
    },
    env.JWT_SECRET
  );

  await db
    .update(schema.users)
    .set({ lastLoginAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.users.id, row.user.id));

  await writeAuditLog({
    actorUserId: row.user.id,
    actorName: row.user.username,
    action: 'login',
    entityType: 'user',
    entityId: row.user.id,
    ipAddress: clientIp(req)
  });

  const res = jsonOk({
    id: row.user.id,
    username: row.user.username,
    email: row.user.email,
    role: row.role.code,
    roleLabel: row.role.name,
    mustChangePassword: row.user.mustChangePassword
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  });
  return res;
});
