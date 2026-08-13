import { NextRequest } from 'next/server';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth/password';

const createSchema = z.object({
  username: z.string().min(3).max(40).regex(/^[a-z0-9._-]+$/i, 'Username hanya boleh huruf, angka, titik, garis bawah/hubung.'),
  email: z.string().email(),
  roleCode: z.enum(['super_admin', 'admin_jaspel', 'verifikator_unit', 'keuangan', 'direktur', 'pegawai', 'auditor']),
  workUnitId: z.string().optional(),
  employeeId: z.string().optional()
});

function generateTemporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export const GET = withApi(async () => {
  const session = await requireSession();
  requireRole(session, [ROLES.SUPER_ADMIN]);
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      isActive: schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
      roleCode: schema.roles.code,
      roleName: schema.roles.name,
      workUnitId: schema.users.workUnitId
    })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .orderBy(asc(schema.users.username));
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, [ROLES.SUPER_ADMIN]);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, parsed.data.roleCode)).limit(1);
  if (!role) return jsonError('Peran tidak ditemukan.', 422);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const id = newId('usr');

  await db.insert(schema.users).values({
    id,
    username: parsed.data.username.toLowerCase(),
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    roleId: role.id,
    workUnitId: parsed.data.workUnitId ?? null,
    employeeId: parsed.data.employeeId ?? null,
    mustChangePassword: true
  });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'create',
    entityType: 'user',
    entityId: id,
    after: { username: parsed.data.username, email: parsed.data.email, role: role.code }
  });

  return jsonOk({ id, temporaryPassword }, 201);
});
