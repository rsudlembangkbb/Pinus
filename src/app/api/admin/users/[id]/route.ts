import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit';

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  roleCode: z.enum(['super_admin', 'admin_jaspel', 'verifikator_unit', 'keuangan', 'direktur', 'pegawai', 'auditor']).optional(),
  workUnitId: z.string().nullable().optional()
});

export const PATCH = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, [ROLES.SUPER_ADMIN]);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const [before] = await db.select().from(schema.users).where(eq(schema.users.id, resolvedParams.id)).limit(1);
  if (!before) return jsonError('Pengguna tidak ditemukan.', 404);

  let roleId: string | undefined;
  if (parsed.data.roleCode) {
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, parsed.data.roleCode)).limit(1);
    if (!role) return jsonError('Peran tidak ditemukan.', 422);
    roleId = role.id;
  }

  await db
    .update(schema.users)
    .set({
      isActive: parsed.data.isActive,
      roleId,
      workUnitId: parsed.data.workUnitId,
      // Bumping tokenVersion invalidates any existing session JWTs for this
      // user immediately when their role/access changes, per RBAC integrity.
      tokenVersion: parsed.data.roleCode || parsed.data.isActive === false ? before.tokenVersion + 1 : before.tokenVersion,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(schema.users.id, resolvedParams.id));

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'update',
    entityType: 'user',
    entityId: resolvedParams.id,
    before: { isActive: before.isActive, roleId: before.roleId },
    after: parsed.data
  });

  return jsonOk({ id: resolvedParams.id });
});
