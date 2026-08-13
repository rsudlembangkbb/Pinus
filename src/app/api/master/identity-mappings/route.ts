import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { MASTER_DATA_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';

const createSchema = z.object({
  employeeId: z.string().min(1),
  sourceSystem: z.enum(['simrs', 'baraya', 'bpjs', 'kinerja']),
  externalCode: z.string().min(1).max(60),
  notes: z.string().max(300).optional()
});

export const GET = withApi(async (req: NextRequest) => {
  await requireSession();
  const db = await getDb();
  const employeeId = req.nextUrl.searchParams.get('employeeId');
  const rows = employeeId
    ? await db
        .select()
        .from(schema.employeeIdentityMappings)
        .where(eq(schema.employeeIdentityMappings.employeeId, employeeId))
    : await db.select().from(schema.employeeIdentityMappings).limit(500);
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();

  const existing = await db
    .select()
    .from(schema.employeeIdentityMappings)
    .where(
      and(
        eq(schema.employeeIdentityMappings.sourceSystem, parsed.data.sourceSystem),
        eq(schema.employeeIdentityMappings.externalCode, parsed.data.externalCode)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    return jsonError('Kode eksternal ini sudah dipetakan ke pegawai lain.', 409);
  }

  const id = newId('map');
  await db.insert(schema.employeeIdentityMappings).values({ id, ...parsed.data });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'create',
    entityType: 'employee_identity_mapping',
    entityId: id,
    after: parsed.data
  });

  return jsonOk({ id }, 201);
});
