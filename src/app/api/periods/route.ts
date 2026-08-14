import { NextRequest } from 'next/server';
import { z } from 'zod';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, jsonOk, requireRole, requireSession, withApi } from '@/lib/http';
import { OPERATOR_ROLES } from '@/lib/auth/roles';
import { newId } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { percentToBps } from '@/lib/money';

const createSchema = z.object({
  code: z.string().regex(/^\d{4}-\d{2}$/, 'Format kode periode harus YYYY-MM.'),
  label: z.string().min(4),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  bpjsPendingPolicy: z.enum(['accrual', 'cash', 'hybrid']).default('cash'),
  jaspelBudgetCap: z.number().int().positive().optional(),
  administrationAllocation: z.number().int().positive().optional(),
  teamUnitProportionPercent: z.number().min(0).max(100).default(30),
  teamUnitFixedPortionPercent: z.number().min(0).max(100).default(20),
  hybridDiscountPercent: z.number().min(0).max(100).default(80)
});

export const GET = withApi(async () => {
  await requireSession();
  const db = await getDb();
  const rows = await db.select().from(schema.calculationPeriods).orderBy(desc(schema.calculationPeriods.code));
  return jsonOk(rows);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  requireRole(session, OPERATOR_ROLES);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Data tidak valid.', 422);

  const db = await getDb();
  const id = newId('per');
  await db.insert(schema.calculationPeriods).values({
    id,
    code: parsed.data.code,
    label: parsed.data.label,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    bpjsPendingPolicy: parsed.data.bpjsPendingPolicy,
    jaspelBudgetCap: parsed.data.jaspelBudgetCap ?? null,
    administrationAllocation: parsed.data.administrationAllocation ?? null,
    teamUnitProportionBps: percentToBps(parsed.data.teamUnitProportionPercent),
    teamUnitFixedPortionBps: percentToBps(parsed.data.teamUnitFixedPortionPercent),
    hybridDiscountBps: percentToBps(parsed.data.hybridDiscountPercent),
    openedBy: session.sub,
    status: 'draft'
  });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'create',
    entityType: 'calculation_period',
    entityId: id,
    after: parsed.data
  });

  return jsonOk({ id }, 201);
});
