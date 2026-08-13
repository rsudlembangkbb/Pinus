import { NextRequest } from 'next/server';
import { z } from 'zod';
import { asc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { MASTER_DATA_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { percentToBps } from '@/lib/money';

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(120),
  category: z.enum(['tenaga_medis', 'tenaga_kesehatan', 'administrasi_struktural']),
  weightFactorPercent: z.number().min(1).max(1000).default(100),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0)
});

export const GET = withApi(async () => {
  await requireSession();
  const db = await getDb();
  const rows = await db.select().from(schema.jobGrades).orderBy(asc(schema.jobGrades.sortOrder));
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const id = newId('jg');
  await db.insert(schema.jobGrades).values({
    id,
    code: parsed.data.code,
    name: parsed.data.name,
    category: parsed.data.category,
    weightFactor: percentToBps(parsed.data.weightFactorPercent),
    description: parsed.data.description,
    sortOrder: parsed.data.sortOrder
  });

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'create', entityType: 'job_grade', entityId: id, after: parsed.data });

  return jsonOk({ id }, 201);
});
