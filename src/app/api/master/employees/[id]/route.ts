import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { MASTER_DATA_ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit';

const updateSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  category: z.enum(['medis', 'keperawatan', 'nakes_non_keperawatan', 'administrasi', 'struktural']).optional(),
  profession: z.string().max(120).optional(),
  workUnitId: z.string().nullable().optional(),
  position: z.string().max(120).optional(),
  jobGradeId: z.string().nullable().optional(),
  employmentStatus: z.enum(['pns', 'pppk', 'non_asn']).optional(),
  minimumCategory: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  await requireSession();
  const db = await getDb();
  const [row] = await db.select().from(schema.employees).where(eq(schema.employees.id, resolvedParams.id)).limit(1);
  if (!row) return jsonError('Pegawai tidak ditemukan.', 404);

  const mappings = await db
    .select()
    .from(schema.employeeIdentityMappings)
    .where(eq(schema.employeeIdentityMappings.employeeId, resolvedParams.id));

  return jsonOk({ ...row, identityMappings: mappings });
});

export const PATCH = withApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const [before] = await db.select().from(schema.employees).where(eq(schema.employees.id, resolvedParams.id)).limit(1);
  if (!before) return jsonError('Pegawai tidak ditemukan.', 404);

  await db
    .update(schema.employees)
    .set({ ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.employees.id, resolvedParams.id));

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'update',
    entityType: 'employee',
    entityId: resolvedParams.id,
    before,
    after: parsed.data
  });

  return jsonOk({ id: resolvedParams.id });
});
