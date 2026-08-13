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
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(150),
  attendanceRecordType: z.enum([
    'cuti',
    'sakit',
    'izin',
    'diklat',
    'tugas_belajar',
    'pembinaan_disiplin',
    'perkelahian'
  ]),
  deductionPercent: z.number().min(0).max(100),
  requiresDocument: z.boolean().default(false),
  effectiveFrom: z.string().min(4)
});

export const GET = withApi(async () => {
  await requireSession();
  const db = await getDb();
  const rows = await db.select().from(schema.deductionRules).orderBy(asc(schema.deductionRules.name));
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const id = newId('ddr');
  await db.insert(schema.deductionRules).values({
    id,
    code: parsed.data.code,
    name: parsed.data.name,
    attendanceRecordType: parsed.data.attendanceRecordType,
    deductionBps: percentToBps(parsed.data.deductionPercent),
    requiresDocument: parsed.data.requiresDocument,
    effectiveFrom: parsed.data.effectiveFrom
  });

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'create', entityType: 'deduction_rule', entityId: id, after: parsed.data });

  return jsonOk({ id }, 201);
});
