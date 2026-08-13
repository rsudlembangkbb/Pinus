import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { deductionRuleSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const deductionRuleRoutes = new Hono<AppEnv>();
deductionRuleRoutes.use("*", requireAuth);

deductionRuleRoutes.get("/", requirePermission("master.deduction_rule.read"), async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.deductionRules);
  rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return c.json({ items: rows });
});

deductionRuleRoutes.post("/", requirePermission("master.deduction_rule.write"), async (c) => {
  const body = deductionRuleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data aturan pengurangan tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const data = body.data;

  const openVersions = await db
    .select()
    .from(schema.deductionRules)
    .where(and(eq(schema.deductionRules.code, data.code), isNull(schema.deductionRules.effectiveTo)));

  for (const open of openVersions) {
    if (open.effectiveFrom >= data.effectiveFrom) {
      throw Errors.conflict(`Sudah ada versi aturan ${data.code} yang mulai berlaku ${open.effectiveFrom}`);
    }
    await db.update(schema.deductionRules).set({ effectiveTo: data.effectiveFrom }).where(eq(schema.deductionRules.id, open.id));
  }

  const id = newId();
  await db.insert(schema.deductionRules).values({
    id,
    code: data.code,
    name: data.name,
    percentBp: data.percentBp,
    description: data.description ?? null,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
    isActive: data.isActive ?? true,
  });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "deduction_rule",
    entityId: id,
    after: data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.deductionRules.findFirst({ where: eq(schema.deductionRules.id, id) });
  return c.json(row, 201);
});
