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
  category: z.enum(['administrasi_struktural', 'tenaga_kesehatan']),
  componentKey: z.enum(['pengalaman', 'keterampilan', 'risiko_kerja', 'kegawatdaruratan', 'jabatan', 'capaian_kinerja']),
  label: z.string().min(2).max(120),
  weightPercent: z.number().min(0).max(100),
  effectiveFrom: z.string().min(4)
});

export const GET = withApi(async () => {
  await requireSession();
  const db = await getDb();
  const rows = await db.select().from(schema.indexingWeightComponents).orderBy(asc(schema.indexingWeightComponents.category));
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, MASTER_DATA_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const id = newId('iwc');
  await db.insert(schema.indexingWeightComponents).values({
    id,
    category: parsed.data.category,
    componentKey: parsed.data.componentKey,
    label: parsed.data.label,
    weightBps: percentToBps(parsed.data.weightPercent),
    effectiveFrom: parsed.data.effectiveFrom
  });

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'create', entityType: 'indexing_weight_component', entityId: id, after: parsed.data });

  return jsonOk({ id }, 201);
});
