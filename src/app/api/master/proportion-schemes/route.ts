import { NextRequest } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { MASTER_DATA_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { percentToBps } from '@/lib/money';

const createSchema = z.object({
  workUnitId: z.string().min(1),
  paymentType: z.enum(['jkn', 'non_jkn']),
  role: z.enum(['operator', 'co_operator', 'anestesi', 'dpjp', 'pelaksana', 'unit_tim', 'umum']),
  proportionPercent: z.number().min(0).max(100),
  effectiveFrom: z.string().min(4)
});

export const GET = withApi(async (req: NextRequest) => {
  await requireSession();
  const db = await getDb();
  const workUnitId = req.nextUrl.searchParams.get('workUnitId');
  const rows = workUnitId
    ? await db
        .select()
        .from(schema.proportionSchemes)
        .where(eq(schema.proportionSchemes.workUnitId, workUnitId))
        .orderBy(desc(schema.proportionSchemes.effectiveFrom))
    : await db.select().from(schema.proportionSchemes).orderBy(desc(schema.proportionSchemes.effectiveFrom)).limit(500);
  return jsonOk(rows);
});

/**
 * Creating a new proportion scheme version closes out the previously
 * open-ended version (effectiveTo = null) for the same
 * (unit, paymentType, role) combination, but never mutates/deletes it -
 * historical calculation periods keep referencing the exact version that
 * was active when they ran (PRD 5.1.4 "riwayat versi").
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const { workUnitId, paymentType, role, effectiveFrom } = parsed.data;

  const openEnded = await db
    .select()
    .from(schema.proportionSchemes)
    .where(eq(schema.proportionSchemes.workUnitId, workUnitId));

  const toClose = openEnded.filter(
    (s) => s.paymentType === paymentType && s.role === role && s.effectiveTo === null && s.effectiveFrom < effectiveFrom
  );
  for (const s of toClose) {
    await db.update(schema.proportionSchemes).set({ effectiveTo: effectiveFrom }).where(eq(schema.proportionSchemes.id, s.id));
  }

  const id = newId('psc');
  await db.insert(schema.proportionSchemes).values({
    id,
    workUnitId,
    paymentType,
    role,
    proportionBps: percentToBps(parsed.data.proportionPercent),
    effectiveFrom,
    createdBy: session.sub
  });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'create',
    entityType: 'proportion_scheme',
    entityId: id,
    after: parsed.data
  });

  return jsonOk({ id }, 201);
});
