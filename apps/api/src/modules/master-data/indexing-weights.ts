import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { indexingWeightSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const indexingWeightRoutes = new Hono<AppEnv>();
indexingWeightRoutes.use("*", requireAuth);

indexingWeightRoutes.get("/", requirePermission("master.job_grade.read"), async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.indexingWeights);
  rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return c.json({ items: rows });
});

indexingWeightRoutes.post("/", requirePermission("master.job_grade.write"), async (c) => {
  const body = indexingWeightSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data bobot indeksing tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const data = body.data;

  const openVersions = await db
    .select()
    .from(schema.indexingWeights)
    .where(and(eq(schema.indexingWeights.variable, data.variable), isNull(schema.indexingWeights.effectiveTo)));

  for (const open of openVersions) {
    if (open.effectiveFrom >= data.effectiveFrom) {
      throw Errors.conflict(`Sudah ada versi bobot ${data.variable} yang mulai berlaku ${open.effectiveFrom}`);
    }
    await db.update(schema.indexingWeights).set({ effectiveTo: data.effectiveFrom }).where(eq(schema.indexingWeights.id, open.id));
  }

  const id = newId();
  await db.insert(schema.indexingWeights).values({
    id,
    variable: data.variable,
    weightBp: data.weightBp,
    maxScore: data.maxScore,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
  });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "indexing_weight",
    entityId: id,
    after: data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.indexingWeights.findFirst({ where: eq(schema.indexingWeights.id, id) });
  return c.json(row, 201);
});
