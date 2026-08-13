import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { minimumRequirementSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const minimumRequirementRoutes = new Hono<AppEnv>();
minimumRequirementRoutes.use("*", requireAuth);

minimumRequirementRoutes.get("/", requirePermission("master.deduction_rule.read"), async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.minimumRequirements);
  rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return c.json({ items: rows });
});

minimumRequirementRoutes.post("/", requirePermission("master.deduction_rule.write"), async (c) => {
  const body = minimumRequirementSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data minimum requirement tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const data = body.data;

  const openVersions = await db
    .select()
    .from(schema.minimumRequirements)
    .where(and(eq(schema.minimumRequirements.professionKey, data.professionKey), isNull(schema.minimumRequirements.effectiveTo)));

  for (const open of openVersions) {
    if (open.effectiveFrom >= data.effectiveFrom) {
      throw Errors.conflict(`Sudah ada versi minimum requirement untuk ${data.professionKey} yang mulai berlaku ${open.effectiveFrom}`);
    }
    await db.update(schema.minimumRequirements).set({ effectiveTo: data.effectiveFrom }).where(eq(schema.minimumRequirements.id, open.id));
  }

  const id = newId();
  await db.insert(schema.minimumRequirements).values({
    id,
    professionKey: data.professionKey,
    label: data.label,
    minAmount: data.minAmount,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
  });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "minimum_requirement",
    entityId: id,
    after: data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.minimumRequirements.findFirst({ where: eq(schema.minimumRequirements.id, id) });
  return c.json(row, 201);
});
