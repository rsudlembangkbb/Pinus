import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireSession, withApi } from '@/lib/http';
import { hashPassword, validatePasswordPolicy, verifyPassword } from '@/lib/auth/password';
import { writeAuditLog } from '@/lib/audit';
import { SESSION_COOKIE } from '@/lib/auth/session';

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1)
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError('Data tidak valid.', 422);

  const policyError = validatePasswordPolicy(parsed.data.newPassword);
  if (policyError) return jsonError(policyError, 422);

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.sub)).limit(1);
  if (!user) return jsonError('Pengguna tidak ditemukan.', 404);

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return jsonError('Kata sandi saat ini salah.', 401);

  const newHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(schema.users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(schema.users.id, user.id));

  await writeAuditLog({ actorUserId: user.id, actorName: user.username, action: 'change_password', entityType: 'user', entityId: user.id });

  // Token version was bumped, so the current session token is now invalid too - force re-login.
  const res = jsonOk({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
