import { NextRequest } from 'next/server';
import { z } from 'zod';
import { asc, like, or } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { MASTER_DATA_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';

const createSchema = z.object({
  nip: z.string().min(1).max(30).optional(),
  nik: z.string().max(30).optional(),
  name: z.string().min(2).max(150),
  category: z.enum(['medis', 'keperawatan', 'nakes_non_keperawatan', 'administrasi', 'struktural']),
  profession: z.string().max(120).optional(),
  workUnitId: z.string().optional(),
  position: z.string().max(120).optional(),
  jobGradeId: z.string().optional(),
  employmentStatus: z.enum(['pns', 'pppk', 'non_asn']).default('pns'),
  startDate: z.string().optional(),
  minimumCategory: z.string().optional()
});

export const GET = withApi(async (req: NextRequest) => {
  await requireSession();
  const db = await getDb();
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const rows = q
    ? await db
        .select()
        .from(schema.employees)
        .where(or(like(schema.employees.name, `%${q}%`), like(schema.employees.nip, `%${q}%`)))
        .orderBy(asc(schema.employees.name))
        .limit(200)
    : await db.select().from(schema.employees).orderBy(asc(schema.employees.name)).limit(200);
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const id = newId('emp');
  await db.insert(schema.employees).values({ id, ...parsed.data });

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'create', entityType: 'employee', entityId: id, after: parsed.data });

  return jsonOk({ id }, 201);
});
